import WidgetKit
import SwiftUI

// MARK: - Timeline Entry
struct AquariumEntry: TimelineEntry {
    let date: Date
    let timeOfDay: SharedTimeOfDay
    let creatures: [WidgetCreature]
}

/// 위젯에 표시될 캐릭터 (위치 포함)
struct WidgetCreature: Identifiable {
    let id = UUID()
    let emoji: String?
    let imageData: Data?
    let size: CGFloat
    let xRatio: CGFloat  // 0~1 (위젯 너비 비율)
    let yRatio: CGFloat  // 0~1 (위젯 높이 비율)
    let isFlipped: Bool
}

// MARK: - Timeline Provider
struct AquariumTimelineProvider: TimelineProvider {

    func placeholder(in context: Context) -> AquariumEntry {
        makeEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (AquariumEntry) -> Void) {
        completion(makeEntry(date: Date()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<AquariumEntry>) -> Void) {
        let now = Date()
        var entries: [AquariumEntry] = []

        // 현재 시간대 엔트리
        entries.append(makeEntry(date: now))

        // 15분 간격으로 캐릭터 위치 변경 (움직이는 느낌)
        for i in 1...8 {
            let futureDate = Calendar.current.date(byAdding: .minute, value: 15 * i, to: now)!
            entries.append(makeEntry(date: futureDate))
        }

        // 다음 시간대 전환 시점에 리프레시
        let nextRefresh = SharedTimeOfDay.current.nextTransitionDate
        let timeline = Timeline(entries: entries, policy: .after(nextRefresh))
        completion(timeline)
    }

    /// 엔트리 생성: 캐릭터를 랜덤 위치에 배치
    private func makeEntry(date: Date) -> AquariumEntry {
        let timeOfDay = SharedTimeOfDay.current
        let savedCreatures = SharedDataManager.loadCreatures()

        // 캐릭터를 위젯 안에 랜덤 배치
        let widgetCreatures = savedCreatures.prefix(8).map { creature in
            WidgetCreature(
                emoji: creature.emoji,
                imageData: creature.imageData,
                size: creature.size * 0.6,  // 위젯용 축소
                xRatio: CGFloat.random(in: 0.10...0.90),
                yRatio: CGFloat.random(in: 0.15...0.72),
                isFlipped: Bool.random()
            )
        }

        return AquariumEntry(
            date: date,
            timeOfDay: timeOfDay,
            creatures: widgetCreatures
        )
    }
}

// MARK: - Widget Definition
struct AquariumWidget: Widget {
    let kind: String = "AquariumWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: AquariumTimelineProvider()) { entry in
            AquariumWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("나의 수족관")
        .description("시간대에 따라 변하는 나만의 수족관")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
