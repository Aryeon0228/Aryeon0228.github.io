import SwiftUI

/// 터치 시 생기는 거품
struct Bubble: Identifiable {
    let id = UUID()
    var x: CGFloat
    var y: CGFloat
    var size: CGFloat
    var opacity: Double
    var speed: CGFloat

    init(x: CGFloat, y: CGFloat) {
        self.x = x
        self.y = y
        self.size = CGFloat.random(in: 8...24)
        self.opacity = Double.random(in: 0.4...0.8)
        self.speed = CGFloat.random(in: 1.5...4.0)
    }
}
