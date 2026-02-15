import SwiftUI

/// 메인 수족관 뷰
struct AquariumView: View {
    @ObservedObject var viewModel: AquariumViewModel

    var body: some View {
        GeometryReader { geo in
            ZStack {
                // 배경 (시간대별)
                OceanBackgroundView(timeOfDay: viewModel.timeOfDay, size: geo.size)

                // 거품들
                ForEach(viewModel.bubbles) { bubble in
                    BubbleView(bubble: bubble)
                }

                // 캐릭터들
                ForEach(viewModel.creatures) { creature in
                    CreatureView(creature: creature) {
                        viewModel.bounceCreature(id: creature.id)
                        viewModel.spawnBubbles(at: CGPoint(x: creature.x, y: creature.y - 20))
                    }
                }

                // 시간대 표시 (좌측 상단)
                VStack {
                    HStack {
                        TimeIndicator(timeOfDay: viewModel.timeOfDay)
                        Spacer()
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 8)
                    Spacer()
                }
            }
            .contentShape(Rectangle())
            .onTapGesture { location in
                viewModel.spawnBubbles(at: location)
            }
            .onAppear {
                viewModel.aquariumSize = geo.size
            }
            .onChange(of: geo.size) { newSize in
                viewModel.aquariumSize = newSize
            }
        }
    }
}

// MARK: - 시간대 인디케이터
struct TimeIndicator: View {
    let timeOfDay: TimeOfDay

    private var icon: String {
        switch timeOfDay {
        case .dawn:      return "sunrise"
        case .morning:   return "sun.max"
        case .afternoon: return "sun.max.fill"
        case .evening:   return "sunset"
        case .night:     return "moon.stars"
        }
    }

    var body: some View {
        HStack(spacing: 4) {
            Image(systemName: icon)
                .font(.caption)
            Text(timeOfDay.displayName)
                .font(.caption)
                .fontWeight(.medium)
        }
        .foregroundStyle(.white.opacity(0.7))
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .background(.ultraThinMaterial.opacity(0.5))
        .clipShape(Capsule())
    }
}

#Preview {
    AquariumView(viewModel: AquariumViewModel())
        .ignoresSafeArea()
}
