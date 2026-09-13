export const materialNotes = {
  oilSlick: {
    mechanism: '얇은 막의 간섭',
    description: '물 위에 얇게 퍼진 기름막의 윗면과 아랫면에서 반사된 빛 파동이 서로 겹칩니다. 이때 어떤 색은 강해지고 어떤 색은 약해지는 간섭이 일어나 무지갯빛이 보여요. 막의 두께와 바라보는 각도에 따라 강조되는 색이 달라지고, 실제 기름막에서는 두께가 고르지 않아 여러 색의 무늬가 생깁니다.',
    simulation: '여기서는 두께가 균일한 얇은 막으로 각도에 따른 색 변화를 근사합니다.',
    source: {
      label: 'Harvard · 얇은 막의 간섭',
      url: 'https://sciencedemonstrations.fas.harvard.edu/presentations/thin-film-interference'
    }
  },
  soapBubble: {
    mechanism: '비눗막의 간섭',
    description: '비눗방울의 얇은 물막 앞뒤에서 반사된 빛이 겹치면서 특정 파장의 색을 강화하거나 상쇄합니다. 막의 두께와 보는 각도에 따라 분홍, 초록, 파랑 같은 색이 번갈아 보여요. 실제 비눗방울에서는 물이 흐르며 막 두께가 변하므로 색 무늬도 움직이고, 아주 얇아진 부분은 어둡게 보일 수 있습니다.',
    simulation: '여기서는 균일한 막의 색과 투명도를 근사하며, 흘러내리는 색 무늬는 재현하지 않습니다.',
    source: {
      label: 'Harvard · 비눗막의 간섭',
      url: 'https://sciencedemonstrations.fas.harvard.edu/presentations/thin-film-interference'
    }
  },
  bismuth: {
    mechanism: '표면 산화막의 간섭',
    description: '비스무트 결정의 화려한 색은 표면에 생긴 아주 얇은 산화막과 관련이 있어요. 산화막 표면과 그 아래에서 반사된 빛 파동이 겹치며, 파장에 따라 서로 강화되거나 상쇄됩니다. 이 얇은 막의 두께가 부위마다 다르기 때문에 노랑, 보라, 파랑 등 여러 간섭색이 결정 표면에 나타납니다.',
    simulation: '얇은 막 효과로 색감을 근사하며, 실제 비스무트의 실측 광학값은 사용하지 않습니다.',
    source: {
      label: 'CCDC · 결정의 색과 빛 (PDF)',
      url: 'https://www.ccdc.cam.ac.uk/media/Web-Crystallization.pdf'
    }
  },
  iridescent: {
    mechanism: '미세한 배열이 만드는 구조색',
    description: '유색 효과가 있는 보석 오팔 안에는 아주 작은 실리카 구슬들이 규칙적으로 모여 있습니다. 이 배열에서 빛이 회절하고 서로 간섭하여 특정 색이 강해지는 구조색이 나타나요. 구슬의 크기와 배열, 바라보는 방향에 따라 색 조각이 다르게 반짝이며, 모든 오팔이 이런 무지갯빛을 보이는 것은 아닙니다.',
    simulation: '이 오팔빛 프리셋은 얇은 막 효과로 색감을 근사하며, 실제 오팔의 내부 배열은 재현하지 않습니다.',
    source: {
      label: 'GIA · 오팔의 유색 효과',
      url: 'https://www.gia.edu/opal-description'
    }
  },
  holographic: {
    mechanism: '미세 무늬에 의한 회절',
    description: '카드나 포장에 쓰는 무지갯빛 홀로그램 필름에는 빛을 회절시키는 아주 미세한 무늬가 새겨져 있습니다. 파장마다 빛이 강해지는 방향이 달라서 각도를 바꾸면 색도 달라져요. 홀로그램은 이런 무늬로 물체에서 온 빛의 파동을 재구성해 깊이감 있는 상을 보여줄 수도 있습니다.',
    simulation: '여기서는 얇은 막 효과로 무지갯빛만 근사하며, 회절 무늬나 홀로그램 영상은 재현하지 않습니다.',
    source: {
      label: 'MIT · 무지갯빛 홀로그램 (PDF)',
      url: 'https://ocw.mit.edu/courses/mas-450-holographic-imaging-spring-2003/d8da840f0c0acd685106df4617eebf91_ch14rainbowholograms.pdf'
    }
  },
  cdSurface: {
    mechanism: '촘촘한 트랙의 회절',
    description: 'CD 표면에 촘촘하게 나란히 이어지는 데이터 트랙은 빛에 대해 회절 격자처럼 작용합니다. 이웃한 트랙에서 나온 빛 파동이 겹치며, 파장마다 서로 강해지는 방향이 달라져 흰빛이 여러 색으로 갈라져 보여요. 그래서 디스크나 광원의 각도를 바꾸면 표면의 무지갯빛 띠가 움직입니다.',
    simulation: '여기서는 얇은 막 효과로 색감을 근사하며, 실제 CD 트랙의 회절 방향은 계산하지 않습니다.',
    source: {
      label: 'Randolph College · CD의 회절',
      url: 'https://physics.randolphcollege.edu/psheldon/classes/p3332/Labs/Laser/CD.htm'
    }
  },
  pearl: {
    mechanism: '진주층의 간섭과 내부 산란',
    description: '진주층에는 얇은 아라고나이트 결정층과 유기물층이 여러 겹 쌓여 있습니다. 여러 층에서 반사된 빛의 간섭이 특정 색을 강조하고, 내부에서 흩어진 빛도 층을 통과하며 색을 띠어요. 이렇게 반사와 투과, 산란이 함께 작용해 진주 특유의 부드러운 광택과 은은하게 겹쳐 보이는 색을 만듭니다.',
    simulation: '여기서는 얇은 막 효과와 부드러운 광택으로 근사하며, 진주 내부의 다층 구조와 산란은 재현하지 않습니다.',
    source: {
      label: 'Scientific Reports · 진주의 구조색',
      url: 'https://www.nature.com/articles/s41598-021-94737-w'
    }
  }
};
