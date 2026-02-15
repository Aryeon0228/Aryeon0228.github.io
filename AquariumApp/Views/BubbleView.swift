import SwiftUI

/// 거품 렌더링
struct BubbleView: View {
    let bubble: Bubble

    var body: some View {
        Circle()
            .fill(
                RadialGradient(
                    colors: [
                        .white.opacity(bubble.opacity * 0.6),
                        .cyan.opacity(bubble.opacity * 0.3),
                        .clear
                    ],
                    center: .topLeading,
                    startRadius: 0,
                    endRadius: bubble.size / 2
                )
            )
            .overlay(
                Circle()
                    .stroke(.white.opacity(bubble.opacity * 0.5), lineWidth: 0.8)
            )
            .frame(width: bubble.size, height: bubble.size)
            .position(x: bubble.x, y: bubble.y)
    }
}
