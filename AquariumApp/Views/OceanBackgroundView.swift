import SwiftUI

/// 시간대에 따라 변하는 수족관 배경
struct OceanBackgroundView: View {
    let timeOfDay: TimeOfDay
    let size: CGSize

    var body: some View {
        ZStack {
            // 배경 그라디언트
            LinearGradient(
                colors: timeOfDay.backgroundColors,
                startPoint: .top,
                endPoint: .bottom
            )

            // 물 표면 빛 효과
            WaterLightEffect(opacity: timeOfDay.lightOpacity)

            // 바닥 (모래/산호)
            VStack {
                Spacer()
                SeaFloor(color: timeOfDay.floorColor, width: size.width)
                    .frame(height: size.height * 0.18)
            }

            // 밤에는 별 표시
            if timeOfDay.showStars {
                StarsView()
            }

            // 장식: 해초
            VStack {
                Spacer()
                HStack(alignment: .bottom, spacing: 0) {
                    SeaweedView()
                        .offset(x: size.width * 0.1)
                    Spacer()
                    SeaweedView()
                        .offset(x: -size.width * 0.15)
                    Spacer()
                    SeaweedView()
                        .offset(x: -size.width * 0.05)
                }
                .padding(.bottom, size.height * 0.12)
            }
        }
        .animation(.easeInOut(duration: 3.0), value: timeOfDay.displayName)
    }
}

// MARK: - 물 위 빛 효과
struct WaterLightEffect: View {
    let opacity: Double

    var body: some View {
        VStack {
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [.white.opacity(opacity), .clear],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(height: 80)
            Spacer()
        }
    }
}

// MARK: - 바닥
struct SeaFloor: View {
    let color: Color
    let width: CGFloat

    var body: some View {
        ZStack {
            // 모래 바닥
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [color.opacity(0.8), color],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

            // 바닥 장식
            HStack(spacing: 30) {
                Text("🪸")
                    .font(.system(size: 28))
                    .offset(y: -15)
                Spacer()
                Text("🌿")
                    .font(.system(size: 22))
                    .offset(y: -10)
                Spacer()
                Text("🪨")
                    .font(.system(size: 24))
                    .offset(y: -8)
                Spacer()
                Text("🪸")
                    .font(.system(size: 26))
                    .offset(y: -12)
            }
            .padding(.horizontal, 20)
        }
    }
}

// MARK: - 별 (밤하늘)
struct StarsView: View {
    var body: some View {
        GeometryReader { geo in
            ForEach(0..<12, id: \.self) { i in
                Circle()
                    .fill(.white)
                    .frame(width: CGFloat.random(in: 1.5...3.5))
                    .opacity(Double.random(in: 0.3...0.8))
                    .position(
                        x: CGFloat(i) * geo.size.width / 12 + CGFloat.random(in: 0...30),
                        y: CGFloat.random(in: 10...(geo.size.height * 0.15))
                    )
            }
        }
    }
}

// MARK: - 해초
struct SeaweedView: View {
    @State private var sway = false

    var body: some View {
        Text("🌾")
            .font(.system(size: CGFloat.random(in: 28...42)))
            .rotationEffect(.degrees(sway ? -8 : 8), anchor: .bottom)
            .animation(
                .easeInOut(duration: Double.random(in: 2.0...3.5))
                .repeatForever(autoreverses: true),
                value: sway
            )
            .onAppear { sway = true }
    }
}

#Preview {
    OceanBackgroundView(timeOfDay: .afternoon, size: CGSize(width: 393, height: 700))
        .ignoresSafeArea()
}
