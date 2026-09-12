export const presetCategoryLabels={metals:'금속',nonmetals:'비금속',special:'코팅·광학'};

export const presetLabels={
 gold:'금',goldRose:'로즈 골드',silver:'은',chrome:'크롬',copper:'구리',copperOxidized:'구리 · 녹청',iron:'철',ironRust:'철 · 녹',aluminum:'알루미늄',aluminumOxidized:'알루미늄 · 산화',aluminumAnodized:'알루미늄 · 아노다이징',titanium:'티타늄',brushedMetal:'브러시 금속',brass:'황동',bronze:'청동',
 plastic:'플라스틱 · 빨강',plasticWhite:'플라스틱 · 흰색',plasticBlack:'플라스틱 · 검정',rubber:'고무',wood:'목재',woodPolished:'목재 · 유광',leather:'가죽',ceramic:'세라믹',glass:'유리',fabric:'직물',velvet:'벨벳',skin:'피부',
 carPaint:'자동차 도장 · 빨강',carPaintBlue:'자동차 도장 · 파랑',carPaintBlack:'자동차 도장 · 검정',pearl:'진주',iridescent:'오팔빛',holographic:'홀로그램',soapBubble:'비눗방울',oilSlick:'기름막',cdSurface:'CD 표면',bismuth:'비스무트',silk:'실크',satin:'새틴'
};

// Three r160's reflectivity accessor maps the legacy slider to dielectric IOR.
export const specularToIor=specular=>(1+.4*specular)/(1-.4*specular);
export const iorToSpecular=ior=>Math.min(1,Math.max(0,2.5*(ior-1)/(ior+1)));
