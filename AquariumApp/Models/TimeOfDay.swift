import SwiftUI

/// 시간대별 수족관 분위기 변화
enum TimeOfDay: CaseIterable {
    case dawn      // 05~07
    case morning   // 07~12
    case afternoon // 12~17
    case evening   // 17~20
    case night     // 20~05

    static var current: TimeOfDay {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<7:   return .dawn
        case 7..<12:  return .morning
        case 12..<17: return .afternoon
        case 17..<20: return .evening
        default:      return .night
        }
    }

    /// 배경 그라디언트 색상
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

    /// 바닥 색상
    var floorColor: Color {
        switch self {
        case .dawn:      return Color(red: 0.85, green: 0.70, blue: 0.50)
        case .morning:   return Color(red: 0.76, green: 0.65, blue: 0.45)
        case .afternoon: return Color(red: 0.70, green: 0.58, blue: 0.38)
        case .evening:   return Color(red: 0.45, green: 0.35, blue: 0.28)
        case .night:     return Color(red: 0.15, green: 0.12, blue: 0.10)
        }
    }

    /// 물 표면 빛 효과 투명도
    var lightOpacity: Double {
        switch self {
        case .dawn:      return 0.25
        case .morning:   return 0.35
        case .afternoon: return 0.40
        case .evening:   return 0.15
        case .night:     return 0.05
        }
    }

    /// 별 표시 여부 (밤)
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
}
