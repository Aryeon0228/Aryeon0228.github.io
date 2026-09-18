/*
	Snap UV Vertices
	Unwrap UVW에서 일정 거리 안의 UV 버텍스들을 평균 위치로 스냅
	용도: 살짝 다른 모델링의 UV 아일랜드를 겹친 뒤, 버텍스를 한점으로 정렬
	U/V만 정렬하며 W는 유지. 거리로 연결된 그룹은 연쇄적으로 합쳐짐.
*/

try(destroyDialog SnapUVVerts) catch()

rollout SnapUVVerts "Snap UV Vertices 1.1" width:400 height:240
(
	local lastReadError = ""

	spinner spnThresh "Threshold:" range:[0.00001, 1.0, 0.005] type:#float scale:0.0001 pos:[10,15] width:380
	checkbox chkSelOnly "Selected vertices only" checked:true pos:[10,48]
	-- Empty captions need explicit bounds so later status text is not clipped.
	label lblInfo "Reading selection..." pos:[10,72] width:380 height:20 align:#center
	label lblDetail "" pos:[10,96] width:380 height:20 align:#center
	button btnRun "Snap to Average" pos:[10,124] width:380 height:40 enabled:false
	button btnPreview "Preview (Count Groups)" pos:[10,172] width:380 height:24 enabled:false
	button btnDetails "Status / Error Details" pos:[10,204] width:380 height:24
	timer tmrUpdate interval:500 active:true

	fn getUnwrapMod =
	(
		if selection.count != 1 then return undefined
		local mods = for m in selection[1].modifiers where classof m == Unwrap_UVW collect m
		local activeMod = modPanel.getCurrentObject()
		-- 여러 Unwrap이 있을 때 첫 modifier를 임의로 수정하지 않는다.
		if (findItem mods activeMod) > 0 then return activeMod
		if mods.count == 1 then return mods[1]
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
	fn snapVerts uwMod obj thresh selOnly doMove:true =
	(
		local sampleTime = currentTime
		local numVerts = uwMod.numberVerticesByNode obj
		local vIdx = #()
		local vPos = #()

		-- 대상 버텍스 수집
		if selOnly then
		(
			local sel = uwMod.getSelectedVerticesByNode obj
			for i in sel where i <= numVerts do
			(
				append vIdx i
				append vPos (uwMod.getVertexPositionByNode sampleTime i obj)
			)
		)
		else
		(
			for i = 1 to numVerts do
			(
				append vIdx i
				append vPos (uwMod.getVertexPositionByNode sampleTime i obj)
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

			for m in members do
			(
				-- 2D 스냅: 기존 W 값과 이미 정렬된 정점은 유지한다.
				local targetPos = [avgPos.x, avgPos.y, vPos[m].z]
				if targetPos != vPos[m] then
				(
					if doMove do uwMod.setVertexPosition2ByNode sampleTime vIdx[m] targetPos true true obj
					numMoved += 1
				)
			)
		)

		#(numGroups, numMoved)
	)

	fn updateInfo =
	(
		lastReadError = ""
		local uwMod = getUnwrapMod()
		if uwMod == undefined then
		(
			if selection.count == 0 then
				lblInfo.text = "Select an object with Unwrap UVW."
			else if selection.count > 1 then
				lblInfo.text = "Select only one object."
			else
				lblInfo.text = "Select the target Unwrap UVW in the stack."
			lblDetail.text = ""
			btnRun.enabled = false
			btnPreview.enabled = false
		)
		else
		(
			local obj = selection[1]
			local numTV = uwMod.numberVerticesByNode obj
			local sel = uwMod.getSelectedVerticesByNode obj
			lblInfo.text = ("Target: " + obj.name)
			lblDetail.text = ("UV Verts: " + numTV as string + "  |  Selected: " + sel.numberSet as string)
			btnRun.enabled = true
			btnPreview.enabled = true
		)
	)

	fn refreshInfo =
	(
		try (updateInfo()) catch
		(
			lastReadError = getCurrentException()
			lblInfo.text = "Cannot read this Unwrap UVW."
			lblDetail.text = "See Status / Error Details below."
			btnRun.enabled = false
			btnPreview.enabled = false
		)
		-- align controls placement, not the text inside a fixed-width label.
		-- Max 2020+ can resize native labels; center the measured text bounds.
		if (maxVersion())[1] >= 22000 do
		(
			for statusLabel in #(lblInfo, lblDetail) do
			(
				local textWidth = amin 380 ((ceil (getTextExtent statusLabel.text).x) + 8)
				statusLabel.width = textWidth
				statusLabel.pos = [(400 - textWidth) / 2, statusLabel.pos.y]
			)
		)
	)

	on SnapUVVerts open do refreshInfo()
	on tmrUpdate tick do refreshInfo()

	on btnDetails pressed do
	(
		refreshInfo()
		local details = lblInfo.text + "\n" + lblDetail.text
		if lastReadError != "" do details += "\n\nUV read error:\n" + lastReadError
		-- A separate dialog keeps long object names and errors readable in full.
		messageBox details title:"Snap UV Vertices 1.1 - Status"
	)

	on btnPreview pressed do
	(
		local uwMod = getUnwrapMod()
		if uwMod == undefined then return undefined

		local result = undefined
		try (result = snapVerts uwMod selection[1] spnThresh.value chkSelOnly.checked doMove:false) catch
		(
			messageBox ("Could not read UV vertices.\n" + getCurrentException()) title:"Snap UV Vertices"
			return undefined
		)
		local msg = result[1] as string + " groups found (" + result[2] as string + " verts will be snapped)"
		-- Keep the result readable; the selection timer refreshes the labels.
		messageBox (msg + "\nThreshold: " + (spnThresh.value as string)) title:"Snap Preview"
	)

	on btnRun pressed do
	(
		local uwMod = getUnwrapMod()
		if uwMod == undefined then
		(
			messageBox "Select one object and its target Unwrap UVW modifier in the stack." title:"Notice"
			return undefined
		)

		local obj = selection[1]
		local result = undefined
		try
		(
			if chkSelOnly.checked and (uwMod.getSelectedVerticesByNode obj).numberSet < 2 then
			(
				messageBox "Select at least 2 UV vertices in the UV Editor." title:"Notice"
				return undefined
			)
			undo "Snap UV Verts" on
			(
				result = snapVerts uwMod obj spnThresh.value chkSelOnly.checked doMove:true
			)
		)
		catch
		(
			messageBox ("Snap stopped. If vertices changed, use Undo (Snap UV Verts) to restore them.\n" + getCurrentException()) title:"Snap UV Vertices"
			return undefined
		)

		redrawViews()

		-- 결과 메시지
		local msg = ""
		if result[2] > 0 then
			msg = result[1] as string + " groups snapped.\n" + result[2] as string + " vertices moved to average positions."
		else
			msg = "No UV vertices need moving at this threshold."

		messageBox msg title:"Snap UV Vertices"
		refreshInfo()
	)
)

createDialog SnapUVVerts
