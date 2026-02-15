import SwiftUI

/// 개별 캐릭터 렌더링 (이모지 or 사진)
struct CreatureView: View {
    let creature: Creature
    let onTap: () -> Void

    @State private var floatOffset: CGFloat = 0

    var body: some View {
        Group {
            if let emoji = creature.emoji {
                Text(emoji)
                    .font(.system(size: creature.size))
            } else if let imageData = creature.imageData,
                      let uiImage = UIImage(data: imageData) {
                Image(uiImage: uiImage)
                    .resizable()
                    .scaledToFit()
                    .frame(width: creature.size, height: creature.size)
                    .clipShape(Circle())
            }
        }
        .scaleEffect(x: creature.isFlipped ? -1 : 1, y: 1)
        .scaleEffect(creature.isBouncing ? 1.4 : 1.0)
        .offset(y: sin(creature.wobblePhase) * 3)
        .animation(.spring(response: 0.3, dampingFraction: 0.5), value: creature.isBouncing)
        .position(x: creature.x, y: creature.y)
        .onTapGesture {
            onTap()
        }
    }
}
