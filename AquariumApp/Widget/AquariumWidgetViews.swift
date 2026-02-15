import SwiftUI
import WidgetKit

// MARK: - 위젯 메인 뷰
struct AquariumWidgetEntryView: View {
    let entry: AquariumEntry

    @Environment(\.widgetFamily) var family

    var body: some View {
        ZStack {
            // 배경
            widgetBackground

            // 물 위 빛
            VStack {
                Rectangle()
                    .fill(
                        LinearGradient(
                            colors: [.white.opacity(entry.timeOfDay.lightOpacity), .clear],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .frame(height: lightHeight)
                Spacer()
            }

            // 별 (밤/저녁)
            if entry.timeOfDay.showStars {
                WidgetStarsView()
            }

            // 캐릭터들
            GeometryReader { geo in
                ForEach(entry.creatures) { creature in
                    WidgetCreatureView(creature: creature)
                        .position(
                            x: creature.xRatio * geo.size.width,
                            y: creature.yRatio * geo.size.height
                        )
                }
            }

            // 바닥
            VStack {
                Spacer()
                WidgetSeaFloor(
                    color: entry.timeOfDay.floorColor,
                    family: family
                )
            }

            // 시간대 + 장식
            VStack {
                HStack {
                    WidgetTimeLabel(timeOfDay: entry.timeOfDay)
                    Spacer()
                }
                .padding(.top, 8)
                .padding(.leading, 10)
                Spacer()
            }
        }
        .containerBackground(for: .widget) {
            LinearGradient(
                colors: entry.timeOfDay.backgroundColors,
                startPoint: .top,
                endPoint: .bottom
            )
        }
    }

    private var widgetBackground: some View {
        LinearGradient(
            colors: entry.timeOfDay.backgroundColors,
            startPoint: .top,
            endPoint: .bottom
        )
    }

    private var lightHeight: CGFloat {
        switch family {
        case .systemSmall:  return 30
        case .systemMedium: return 35
        case .systemLarge:  return 50
        default: return 30
        }
    }
}

// MARK: - 위젯용 캐릭터
struct WidgetCreatureView: View {
    let creature: WidgetCreature

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
    }
}

// MARK: - 위젯용 바닥
struct WidgetSeaFloor: View {
    let color: Color
    let family: WidgetFamily

    private var height: CGFloat {
        switch family {
        case .systemSmall:  return 28
        case .systemMedium: return 30
        case .systemLarge:  return 45
        default: return 28
        }
    }

    private var emojiSize: CGFloat {
        switch family {
        case .systemSmall:  return 14
        case .systemMedium: return 16
        case .systemLarge:  return 22
        default: return 14
        }
    }

    var body: some View {
        ZStack(alignment: .top) {
            Rectangle()
                .fill(
                    LinearGradient(
                        colors: [color.opacity(0.6), color],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )
                .frame(height: height)

            HStack {
                Text("🪸")
                    .font(.system(size: emojiSize))
                    .offset(y: -emojiSize * 0.4)
                Spacer()
                Text("🌿")
                    .font(.system(size: emojiSize * 0.85))
                    .offset(y: -emojiSize * 0.3)
                Spacer()
                Text("🪨")
                    .font(.system(size: emojiSize * 0.9))
                    .offset(y: -emojiSize * 0.2)

                if family != .systemSmall {
                    Spacer()
                    Text("🪸")
                        .font(.system(size: emojiSize))
                        .offset(y: -emojiSize * 0.35)
                }
            }
            .padding(.horizontal, 8)
        }
    }
}

// MARK: - 위젯용 시간 라벨
struct WidgetTimeLabel: View {
    let timeOfDay: SharedTimeOfDay

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: timeOfDay.icon)
                .font(.system(size: 9))
            Text(timeOfDay.displayName)
                .font(.system(size: 9, weight: .medium))
        }
        .foregroundStyle(.white.opacity(0.75))
        .padding(.horizontal, 7)
        .padding(.vertical, 3)
        .background(.ultraThinMaterial.opacity(0.4))
        .clipShape(Capsule())
    }
}

// MARK: - 위젯용 별
struct WidgetStarsView: View {
    var body: some View {
        GeometryReader { geo in
            ForEach(0..<6, id: \.self) { i in
                Circle()
                    .fill(.white)
                    .frame(width: 2)
                    .opacity(0.6)
                    .position(
                        x: CGFloat(i) * geo.size.width / 6 + 10,
                        y: CGFloat(i % 3) * 8 + 12
                    )
            }
        }
    }
}

// MARK: - Previews
#Preview("Small", as: .systemSmall) {
    AquariumWidget()
} timeline: {
    AquariumEntry(
        date: Date(),
        timeOfDay: .afternoon,
        creatures: [
            WidgetCreature(emoji: "🐠", imageData: nil, size: 32, xRatio: 0.3, yRatio: 0.4, isFlipped: false),
            WidgetCreature(emoji: "🦑", imageData: nil, size: 36, xRatio: 0.7, yRatio: 0.5, isFlipped: true),
            WidgetCreature(emoji: "🐟", imageData: nil, size: 28, xRatio: 0.5, yRatio: 0.3, isFlipped: false),
        ]
    )
}

#Preview("Medium", as: .systemMedium) {
    AquariumWidget()
} timeline: {
    AquariumEntry(
        date: Date(),
        timeOfDay: .night,
        creatures: [
            WidgetCreature(emoji: "🐠", imageData: nil, size: 34, xRatio: 0.2, yRatio: 0.4, isFlipped: false),
            WidgetCreature(emoji: "🦑", imageData: nil, size: 38, xRatio: 0.5, yRatio: 0.5, isFlipped: true),
            WidgetCreature(emoji: "🐟", imageData: nil, size: 30, xRatio: 0.8, yRatio: 0.35, isFlipped: false),
            WidgetCreature(emoji: "🪼", imageData: nil, size: 28, xRatio: 0.35, yRatio: 0.55, isFlipped: false),
        ]
    )
}

#Preview("Large", as: .systemLarge) {
    AquariumWidget()
} timeline: {
    AquariumEntry(
        date: Date(),
        timeOfDay: .evening,
        creatures: [
            WidgetCreature(emoji: "🐠", imageData: nil, size: 38, xRatio: 0.25, yRatio: 0.3, isFlipped: false),
            WidgetCreature(emoji: "🦑", imageData: nil, size: 42, xRatio: 0.6, yRatio: 0.45, isFlipped: true),
            WidgetCreature(emoji: "🐟", imageData: nil, size: 32, xRatio: 0.8, yRatio: 0.25, isFlipped: false),
            WidgetCreature(emoji: "🪼", imageData: nil, size: 30, xRatio: 0.15, yRatio: 0.55, isFlipped: false),
            WidgetCreature(emoji: "🐡", imageData: nil, size: 35, xRatio: 0.45, yRatio: 0.6, isFlipped: true),
        ]
    )
}
