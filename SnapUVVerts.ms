/*
	Snap UV Vertices
	Unwrap UVW에서 일정 거리 안의 UV 버텍스들을 평균 위치로 스냅
	용도: 살짝 다른 모델링의 UV 아일랜드를 겹친 뒤, 버텍스를 한점으로 정렬
*/

try(destroyDialog SnapUVVerts) catch()

rollout SnapUVVerts "Snap UV Vertices" width:300 height:210
(
	spinner spnThresh "Threshold:" range:[0.00001, 1.0, 0.005] type:#float scale:0.0001 pos:[10,15] width:280
	checkbox chkSelOnly "Selected vertices only" checked:true pos:[10,48]
	label lblInfo "" pos:[10,72]
	label lblDetail "" pos:[10,90]
	button btnRun "Snap to Average" pos:[10,115] width:280 height:40
	button btnPreview "Preview (Count Groups)" pos:[10,160] width:280 height:22
	timer tmrUpdate interval:500 active:true

	fn getUnwrapMod =
	(
		if selection.count != 1 then return undefined
		for m in $.modifiers where classof m == Unwrap_UVW do return m
		undefined
	)

	-- Union-Find: root 찾기 (path compression)
	fn ufFind parents i =
	(
		while parents[i] != i do
		(
			parents[i] = parents[parents[i]]
			i = parents[i]
		)
		i
	)

	-- Union-Find: 두 집합 합치기 (union by rank)
	fn ufUnion parents ranks a b =
	(
		local ra = ufFind parents a
		local rb = ufFind parents b
		if ra == rb then return false
		if ranks[ra] < ranks[rb] then
			parents[ra] = rb
		else if ranks[ra] > ranks[rb] then
			parents[rb] = ra
		else
		(
			parents[rb] = ra
			ranks[ra] += 1
		)
		true
	)

	-- UV 버텍스 그룹 찾기 & 스냅 (doMove=false면 카운트만)
	fn snapVerts uwMod thresh selOnly doMove:true =
	(
		local numVerts = uwMod.numberVertices()
		local vIdx = #()
		local vPos = #()

		-- 대상 버텍스 수집
		if selOnly then
		(
			local sel = uwMod.getSelectedVertices()
			for i in sel do
			(
				append vIdx i
				append vPos (uwMod.getVertexPosition 0f i)
			)
		)
		else
		(
			for i = 1 to numVerts do
			(
				append vIdx i
				append vPos (uwMod.getVertexPosition 0f i)
			)
		)

		local cnt = vIdx.count
		if cnt < 2 then return #(0, 0)

		-- Union-Find 초기화
		local parents = for i = 1 to cnt collect i
		local ranks = for i = 1 to cnt collect 0

		-- 거리 안의 쌍 합치기 (2D 거리)
		local threshSq = thresh * thresh
		for i = 1 to (cnt - 1) do
		(
			local pi = vPos[i]
			for j = (i + 1) to cnt do
			(
				local pj = vPos[j]
				local dx = pi.x - pj.x
				local dy = pi.y - pj.y
				if (dx * dx + dy * dy) < threshSq then
					ufUnion parents ranks i j
			)
		)

		-- root별 그룹 수집
		local rootList = #()
		for i = 1 to cnt do
		(
			local r = ufFind parents i
			appendIfUnique rootList r
		)

		local numGroups = 0
		local numMoved = 0

		for r in rootList do
		(
			-- 이 root에 속한 멤버 수집
			local members = for i = 1 to cnt where (ufFind parents i) == r collect i
			if members.count < 2 then continue

			numGroups += 1

			-- 평균 위치 계산
			local avgPos = [0, 0, 0]
			for m in members do avgPos += vPos[m]
			avgPos /= members.count as float

			if doMove then
			(
				for m in members do
				(
					uwMod.setVertexPosition 0f vIdx[m] avgPos
					numMoved += 1
				)
			)
			else
				numMoved += members.count
		)

		#(numGroups, numMoved)
	)

	fn updateInfo =
	(
		local uwMod = getUnwrapMod()
		if uwMod == undefined then
		(
			if selection.count == 0 then
				lblInfo.text = "Select an object with Unwrap UVW."
			else if selection.count > 1 then
				lblInfo.text = "Select only one object."
			else
				lblInfo.text = "No Unwrap UVW modifier found."
			lblDetail.text = ""
			btnRun.enabled = false
			btnPreview.enabled = false
		)
		else
		(
			local numTV = uwMod.numberVertices()
			local sel = uwMod.getSelectedVertices()
			lblInfo.text = ("Target: " + $.name)
			lblDetail.text = ("UV Verts: " + numTV as string + "  |  Selected: " + sel.numberSet as string)
			btnRun.enabled = true
			btnPreview.enabled = true
		)
	)

	on SnapUVVerts open do updateInfo()
	on tmrUpdate tick do updateInfo()

	on btnPreview pressed do
	(
		local uwMod = getUnwrapMod()
		if uwMod == undefined then return undefined

		local result = snapVerts uwMod spnThresh.value chkSelOnly.checked doMove:false
		local msg = result[1] as string + " groups found (" + result[2] as string + " verts will be snapped)"
		lblInfo.text = msg
		lblDetail.text = "Threshold: " + spnThresh.value as string
	)

	on btnRun pressed do
	(
		local uwMod = getUnwrapMod()
		if uwMod == undefined then
		(
			messageBox "No Unwrap UVW modifier found on selected object." title:"Notice"
			return undefined
		)

		if chkSelOnly.checked and (uwMod.getSelectedVertices()).numberSet < 2 then
		(
			messageBox "Select at least 2 UV vertices in the UV Editor." title:"Notice"
			return undefined
		)

		local result = undefined
		undo "Snap UV Verts" on
		(
			result = snapVerts uwMod spnThresh.value chkSelOnly.checked doMove:true
		)

		-- 완료 사운드
		windows.processPostedMessages()
		dotNetClass "System.Media.SystemSounds"
		(dotNetClass "System.Media.SystemSounds").Beep.Play()

		-- 결과 메시지
		local msg = ""
		if result[1] > 0 then
			msg = result[1] as string + " groups snapped.\n" + result[2] as string + " vertices moved to average positions."
		else
			msg = "No vertices within threshold distance.\nTry increasing the threshold value."

		messageBox msg title:"Snap UV Vertices"
		updateInfo()
	)
)

createDialog SnapUVVerts
