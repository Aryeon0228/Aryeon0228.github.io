import SwiftUI
import PhotosUI

/// 캐릭터 추가/편집 화면
struct CreatureEditorView: View {
    @ObservedObject var viewModel: AquariumViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var selectedTab = 0  // 0: 이모지, 1: 사진
    @State private var selectedPhotoItem: PhotosPickerItem?
    @State private var showDeleteAlert = false
    @State private var creatureToDelete: UUID?

    // 이모지 카테고리
    let seaEmojis = ["🐠", "🐟", "🐡", "🦈", "🐙", "🦑", "🪼", "🦐", "🦞", "🦀",
                     "🐢", "🐳", "🐋", "🐬", "🦭", "🐚", "⭐", "🌊"]
    let funEmojis = ["😎", "🎃", "👻", "🤖", "👾", "🎭", "🧸", "🎈",
                     "🍕", "🍩", "🍦", "🎸", "🚀", "💎", "🔮", "🌸"]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // 탭 선택
                Picker("", selection: $selectedTab) {
                    Text("이모지").tag(0)
                    Text("사진").tag(1)
                }
                .pickerStyle(.segmented)
                .padding()

                if selectedTab == 0 {
                    emojiGrid
                } else {
                    photoSection
                }

                Divider()

                // 현재 캐릭터 목록
                currentCreaturesList
            }
            .navigationTitle("캐릭터 편집")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("완료") { dismiss() }
                }
            }
        }
    }

    // MARK: - 이모지 그리드
    private var emojiGrid: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("바다 생물")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 12) {
                    ForEach(seaEmojis, id: \.self) { emoji in
                        Button {
                            viewModel.addCreature(emoji: emoji)
                        } label: {
                            Text(emoji)
                                .font(.system(size: 36))
                                .frame(width: 52, height: 52)
                                .background(.ultraThinMaterial)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                .padding(.horizontal)

                Text("재미있는 것들")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)

                LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 6), spacing: 12) {
                    ForEach(funEmojis, id: \.self) { emoji in
                        Button {
                            viewModel.addCreature(emoji: emoji)
                        } label: {
                            Text(emoji)
                                .font(.system(size: 36))
                                .frame(width: 52, height: 52)
                                .background(.ultraThinMaterial)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                    }
                }
                .padding(.horizontal)
            }
            .padding(.vertical)
        }
    }

    // MARK: - 사진 선택
    private var photoSection: some View {
        VStack(spacing: 20) {
            Spacer()

            PhotosPicker(selection: $selectedPhotoItem, matching: .images) {
                VStack(spacing: 12) {
                    Image(systemName: "photo.badge.plus")
                        .font(.system(size: 48))
                        .foregroundStyle(.blue)
                    Text("사진 선택하기")
                        .font(.headline)
                    Text("사진첩에서 이미지를 골라\n수족관에 넣어보세요")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 40)
                .background(.ultraThinMaterial)
                .clipShape(RoundedRectangle(cornerRadius: 16))
                .padding(.horizontal)
            }
            .onChange(of: selectedPhotoItem) { newItem in
                Task {
                    if let data = try? await newItem?.loadTransferable(type: Data.self) {
                        // 이미지 리사이즈 (메모리 절약)
                        if let uiImage = UIImage(data: data),
                           let resized = uiImage.resized(to: CGSize(width: 200, height: 200)),
                           let pngData = resized.pngData() {
                            viewModel.addCreature(imageData: pngData)
                        }
                    }
                    selectedPhotoItem = nil
                }
            }

            Spacer()
        }
    }

    // MARK: - 현재 캐릭터 목록
    private var currentCreaturesList: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("수족관에 있는 캐릭터 (\(viewModel.creatures.count))")
                .font(.subheadline)
                .fontWeight(.semibold)
                .foregroundStyle(.secondary)
                .padding(.horizontal)
                .padding(.top, 12)

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                    ForEach(viewModel.creatures) { creature in
                        VStack(spacing: 4) {
                            if let emoji = creature.emoji {
                                Text(emoji)
                                    .font(.system(size: 32))
                            } else if let imageData = creature.imageData,
                                      let uiImage = UIImage(data: imageData) {
                                Image(uiImage: uiImage)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 36, height: 36)
                                    .clipShape(Circle())
                            }

                            Button {
                                viewModel.removeCreature(id: creature.id)
                            } label: {
                                Image(systemName: "minus.circle.fill")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }
                        }
                        .frame(width: 50, height: 60)
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 12)
            }
        }
    }
}

// MARK: - UIImage 리사이즈 헬퍼
extension UIImage {
    func resized(to targetSize: CGSize) -> UIImage? {
        let widthRatio = targetSize.width / size.width
        let heightRatio = targetSize.height / size.height
        let ratio = min(widthRatio, heightRatio)
        let newSize = CGSize(width: size.width * ratio, height: size.height * ratio)

        UIGraphicsBeginImageContextWithOptions(newSize, false, 0)
        draw(in: CGRect(origin: .zero, size: newSize))
        let newImage = UIGraphicsGetImageFromCurrentImageContext()
        UIGraphicsEndImageContext()
        return newImage
    }
}

#Preview {
    CreatureEditorView(viewModel: AquariumViewModel())
}
