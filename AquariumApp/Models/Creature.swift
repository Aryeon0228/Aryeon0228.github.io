import SwiftUI

/// 수족관 안의 캐릭터 (이모지 또는 사진)
struct Creature: Identifiable, Codable {
    let id: UUID

    // 캐릭터 타입: 이모지 or 사진
    var emoji: String?           // "🐠", "🦑" 등
    var imageData: Data?         // 사용자 커스텀 이미지 (PNG data)

    // 위치 & 움직임
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat            // 크기 (40~100)
    var speed: CGFloat           // 이동 속도 (1~5)
    var directionAngle: CGFloat  // 이동 방향 (라디안)
    var isFlipped: Bool          // 좌우 반전

    // 애니메이션 상태 (Codable에서 제외)
    var wobblePhase: CGFloat = 0
    var isBouncing: Bool = false

    init(emoji: String, x: CGFloat, y: CGFloat, size: CGFloat = 60, speed: CGFloat = 2.0) {
        self.id = UUID()
        self.emoji = emoji
        self.imageData = nil
        self.x = x
        self.y = y
        self.size = size
        self.speed = speed
        self.directionAngle = CGFloat.random(in: 0...(2 * .pi))
        self.isFlipped = false
    }

    init(imageData: Data, x: CGFloat, y: CGFloat, size: CGFloat = 60, speed: CGFloat = 2.0) {
        self.id = UUID()
        self.emoji = nil
        self.imageData = imageData
        self.x = x
        self.y = y
        self.size = size
        self.speed = speed
        self.directionAngle = CGFloat.random(in: 0...(2 * .pi))
        self.isFlipped = false
    }

    // Codable - wobblePhase, isBouncing 제외
    enum CodingKeys: String, CodingKey {
        case id, emoji, imageData, x, y, size, speed, directionAngle, isFlipped
    }
}
