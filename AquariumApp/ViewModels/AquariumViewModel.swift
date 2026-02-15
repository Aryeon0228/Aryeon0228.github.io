import SwiftUI
import Combine

class AquariumViewModel: ObservableObject {

    // MARK: - Published State
    @Published var creatures: [Creature] = []
    @Published var bubbles: [Bubble] = []
    @Published var timeOfDay: TimeOfDay = .current
    @Published var aquariumSize: CGSize = .zero

    private var timer: AnyCancellable?
    private var timeCheckTimer: AnyCancellable?
    private let storageKey = "aquarium_creatures"

    // MARK: - Init
    init() {
        loadCreatures()
        if creatures.isEmpty {
            addDefaultCreatures()
        }
        startAnimation()
        startTimeCheck()
    }

    deinit {
        timer?.cancel()
        timeCheckTimer?.cancel()
    }

    // MARK: - Animation Loop (60fps)
    func startAnimation() {
        timer = Timer.publish(every: 1.0 / 60.0, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                self?.updateFrame()
            }
    }

    /// 시간대 체크 (1분마다)
    private func startTimeCheck() {
        timeCheckTimer = Timer.publish(every: 60, on: .main, in: .common)
            .autoconnect()
            .sink { [weak self] _ in
                withAnimation(.easeInOut(duration: 3.0)) {
                    self?.timeOfDay = .current
                }
            }
    }

    // MARK: - Frame Update
    private func updateFrame() {
        guard aquariumSize.width > 0 else { return }

        let dt: CGFloat = 1.0 / 60.0

        for i in creatures.indices {
            updateCreature(&creatures[i], dt: dt)
        }

        updateBubbles(dt: dt)
    }

    private func updateCreature(_ creature: inout Creature, dt: CGFloat) {
        let margin: CGFloat = creature.size / 2

        // 위치 업데이트
        let dx = cos(creature.directionAngle) * creature.speed * 30 * dt
        let dy = sin(creature.directionAngle) * creature.speed * 15 * dt
        creature.x += dx
        creature.y += dy

        // 물결 효과 (상하 흔들림)
        creature.wobblePhase += dt * 2.5
        let wobble = sin(creature.wobblePhase) * 3

        // 벽에 닿으면 방향 전환
        if creature.x < margin || creature.x > aquariumSize.width - margin {
            creature.directionAngle = .pi - creature.directionAngle
            creature.x = max(margin, min(creature.x, aquariumSize.width - margin))
            creature.isFlipped.toggle()
        }

        // 상하 범위 (상단 10% ~ 하단 85%)
        let minY = aquariumSize.height * 0.10 + margin
        let maxY = aquariumSize.height * 0.85 - margin

        if creature.y + wobble < minY || creature.y + wobble > maxY {
            creature.directionAngle = -creature.directionAngle
            creature.y = max(minY, min(creature.y, maxY))
        }

        // 가끔 방향 살짝 변경 (자연스러운 움직임)
        if Int.random(in: 0...300) == 0 {
            creature.directionAngle += CGFloat.random(in: -0.5...0.5)
        }
    }

    private func updateBubbles(dt: CGFloat) {
        for i in bubbles.indices.reversed() {
            bubbles[i].y -= bubbles[i].speed * 40 * dt
            bubbles[i].x += sin(bubbles[i].y * 0.05) * 0.3 // 좌우 흔들림
            bubbles[i].opacity -= 0.003

            // 화면 밖이거나 투명해지면 제거
            if bubbles[i].y < -20 || bubbles[i].opacity <= 0 {
                bubbles.remove(at: i)
            }
        }
    }

    // MARK: - Interactions

    /// 탭하면 거품 생성
    func spawnBubbles(at point: CGPoint) {
        let count = Int.random(in: 3...7)
        for _ in 0..<count {
            let offsetX = CGFloat.random(in: -20...20)
            let offsetY = CGFloat.random(in: -10...10)
            let bubble = Bubble(x: point.x + offsetX, y: point.y + offsetY)
            bubbles.append(bubble)
        }
    }

    /// 캐릭터 탭하면 통통 바운스
    func bounceCreature(id: UUID) {
        guard let index = creatures.firstIndex(where: { $0.id == id }) else { return }
        creatures[index].isBouncing = true

        // 방향 랜덤 변경
        creatures[index].directionAngle = CGFloat.random(in: 0...(2 * .pi))
        creatures[index].speed = min(creatures[index].speed + 1, 6)

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
            guard let self, self.creatures.indices.contains(index) else { return }
            self.creatures[index].isBouncing = false
            self.creatures[index].speed = max(self.creatures[index].speed - 1, 1)
        }
    }

    // MARK: - Creature Management

    func addCreature(emoji: String) {
        let x = CGFloat.random(in: 50...(max(aquariumSize.width - 50, 100)))
        let y = CGFloat.random(in: (aquariumSize.height * 0.2)...(aquariumSize.height * 0.7))
        let creature = Creature(emoji: emoji, x: x, y: y,
                                size: CGFloat.random(in: 40...80),
                                speed: CGFloat.random(in: 1...3.5))
        creatures.append(creature)
        saveCreatures()
    }

    func addCreature(imageData: Data) {
        let x = CGFloat.random(in: 50...(max(aquariumSize.width - 50, 100)))
        let y = CGFloat.random(in: (aquariumSize.height * 0.2)...(aquariumSize.height * 0.7))
        let creature = Creature(imageData: imageData, x: x, y: y,
                                size: CGFloat.random(in: 40...80),
                                speed: CGFloat.random(in: 1...3.5))
        creatures.append(creature)
        saveCreatures()
    }

    func removeCreature(id: UUID) {
        creatures.removeAll { $0.id == id }
        saveCreatures()
    }

    // MARK: - Default Creatures
    private func addDefaultCreatures() {
        let defaults = ["🐠", "🐟", "🦑", "🐡", "🪼"]
        for emoji in defaults {
            let x = CGFloat.random(in: 60...300)
            let y = CGFloat.random(in: 150...500)
            let creature = Creature(emoji: emoji, x: x, y: y,
                                    size: CGFloat.random(in: 40...70),
                                    speed: CGFloat.random(in: 1...3))
            creatures.append(creature)
        }
        saveCreatures()
    }

    // MARK: - Persistence
    private func saveCreatures() {
        if let data = try? JSONEncoder().encode(creatures) {
            UserDefaults.standard.set(data, forKey: storageKey)
        }
    }

    private func loadCreatures() {
        guard let data = UserDefaults.standard.data(forKey: storageKey),
              let saved = try? JSONDecoder().decode([Creature].self, from: data) else { return }
        creatures = saved
    }
}
