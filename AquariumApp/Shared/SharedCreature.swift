import SwiftUI

/// 앱 ↔ 위젯 공유 캐릭터 모델
struct SharedCreature: Identifiable, Codable {
    let id: UUID
    var emoji: String?
    var imageData: Data?
    var size: CGFloat

    init(emoji: String, size: CGFloat = 60) {
        self.id = UUID()
        self.emoji = emoji
        self.imageData = nil
        self.size = size
    }

    init(imageData: Data, size: CGFloat = 60) {
        self.id = UUID()
        self.emoji = nil
        self.imageData = imageData
        self.size = size
    }
}

/// 앱 ↔ 위젯 데이터 공유 (App Group 사용)
struct SharedDataManager {
    /// Xcode에서 App Group ID를 설정한 뒤 이 값을 변경하세요
    /// 예: "group.com.yourname.AquariumApp"
    static let appGroupID = "group.com.aquariumapp"

    static var sharedDefaults: UserDefaults? {
        UserDefaults(suiteName: appGroupID)
    }

    static let creaturesKey = "shared_creatures"

    static func saveCreatures(_ creatures: [SharedCreature]) {
        guard let defaults = sharedDefaults,
              let data = try? JSONEncoder().encode(creatures) else { return }
        defaults.set(data, forKey: creaturesKey)
    }

    static func loadCreatures() -> [SharedCreature] {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: creaturesKey),
              let creatures = try? JSONDecoder().decode([SharedCreature].self, from: data)
        else {
            return defaultCreatures()
        }
        return creatures.isEmpty ? defaultCreatures() : creatures
    }

    static func defaultCreatures() -> [SharedCreature] {
        [
            SharedCreature(emoji: "🐠", size: 55),
            SharedCreature(emoji: "🐟", size: 45),
            SharedCreature(emoji: "🦑", size: 60),
            SharedCreature(emoji: "🐡", size: 40),
            SharedCreature(emoji: "🪼", size: 50),
        ]
    }
}
