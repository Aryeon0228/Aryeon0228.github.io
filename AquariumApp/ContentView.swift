import SwiftUI

/// 메인 화면: 수족관 + 하단 컨트롤
struct ContentView: View {
    @StateObject private var viewModel = AquariumViewModel()
    @State private var showEditor = false

    var body: some View {
        ZStack {
            // 수족관
            AquariumView(viewModel: viewModel)
                .ignoresSafeArea()

            // 하단 버튼들
            VStack {
                Spacer()

                HStack(spacing: 16) {
                    // 캐릭터 편집
                    ControlButton(icon: "plus.circle.fill", label: "추가") {
                        showEditor = true
                    }

                    // 캐릭터 수
                    Text("\(viewModel.creatures.count)마리")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.white.opacity(0.8))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(.ultraThinMaterial.opacity(0.5))
                        .clipShape(Capsule())

                    // 초기화
                    ControlButton(icon: "arrow.counterclockwise", label: "리셋") {
                        viewModel.creatures.removeAll()
                    }
                }
                .padding(.bottom, 30)
            }
        }
        .sheet(isPresented: $showEditor) {
            CreatureEditorView(viewModel: viewModel)
                .presentationDetents([.medium, .large])
        }
        .preferredColorScheme(.dark)
    }
}

// MARK: - 하단 컨트롤 버튼
struct ControlButton: View {
    let icon: String
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.title2)
                Text(label)
                    .font(.caption2)
            }
            .foregroundStyle(.white)
            .frame(width: 60, height: 55)
            .background(.ultraThinMaterial.opacity(0.5))
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
    }
}

#Preview {
    ContentView()
}
