import SwiftUI

/// 앱 ↔ 위젯 공유 시간대 모델
enum SharedTimeOfDay: String, CaseIterable {
    case dawn, morning, afternoon, evening, night

    static var current: SharedTimeOfDay {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<7:   return .dawn
        case 7..<12:  return .morning
        case 12..<17: return .afternoon
        case 17..<20: return .evening
        default:      return .night
        }
    }

    var backgroundColors: [Color] {
        switch self {
        case .dawn:
            return [Color(red: 0.98, green: 0.65, blue: 0.45),
                    Color(red: 0.30, green: 0.55, blue: 0.85)]
        case .morning:
            return [Color(red: 0.55, green: 0.82, blue: 0.95),
                    Color(red: 0.15, green: 0.40, blue: 0.75)]
        case .afternoon:
            return [Color(red: 0.30, green: 0.70, blue: 0.95),
                    Color(red: 0.05, green: 0.25, blue: 0.65)]
        case .evening:
            return [Color(red: 0.75, green: 0.40, blue: 0.55),
                    Color(red: 0.10, green: 0.15, blue: 0.45)]
        case .night:
            return [Color(red: 0.05, green: 0.08, blue: 0.20),
                    Color(red: 0.02, green: 0.05, blue: 0.15)]
        }
    }

    var floorColor: Color {
        switch self {
        case .dawn:      return Color(red: 0.85, green: 0.70, blue: 0.50)
        case .morning:   return Color(red: 0.76, green: 0.65, blue: 0.45)
        case .afternoon: return Color(red: 0.70, green: 0.58, blue: 0.38)
        case .evening:   return Color(red: 0.45, green: 0.35, blue: 0.28)
        case .night:     return Color(red: 0.15, green: 0.12, blue: 0.10)
        }
    }

    var lightOpacity: Double {
        switch self {
        case .dawn: return 0.25
        case .morning: return 0.35
        case .afternoon: return 0.40
        case .evening: return 0.15
        case .night: return 0.05
        }
    }

    var showStars: Bool {
        self == .night || self == .evening
    }

    var displayName: String {
        switch self {
        case .dawn:      return "새벽"
        case .morning:   return "아침"
        case .afternoon: return "오후"
        case .evening:   return "저녁"
        case .night:     return "밤"
        }
    }

    var icon: String {
        switch self {
        case .dawn:      return "sunrise"
        case .morning:   return "sun.max"
        case .afternoon: return "sun.max.fill"
        case .evening:   return "sunset"
        case .night:     return "moon.stars"
        }
    }

    /// 다음 시간대로 변할 시각 (Timeline용)
    var nextTransitionDate: Date {
        let cal = Calendar.current
        let now = Date()
        let today = cal.startOfDay(for: now)

        let transitionHours: [Int] = [5, 7, 12, 17, 20]
        for hour in transitionHours {
            let date = cal.date(byAdding: .hour, value: hour, to: today)!
            if date > now { return date }
        }
        // 내일 새벽 5시
        let tomorrow = cal.date(byAdding: .day, value: 1, to: today)!
        return cal.date(byAdding: .hour, value: 5, to: tomorrow)!
    }
}
