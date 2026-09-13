/*
	Remove Collinear Vertices
	선택한 오브젝트의 잉여 버텍스를 제거하는 스크립트
	선택 오브젝트 전체에서 검사. Threshold는 월드 공간 거리.
*/

try(destroyDialog RemoveCollinearVerts) catch()

rollout RemoveCollinearVerts "Remove Collinear Vertices" width:300 height:200
(
	spinner spnThresh "Threshold (world units):" range:[0.0001, 10.0, 0.001] type:#float scale:0.001 pos:[10,15] width:280
	label lblInfo "" pos:[10,50]
	label lblDetail "" pos:[10,68]
	button btnRun "Remove" pos:[10,95] width:280 height:40 enabled:false
	button btnSelect "Select Verts (Preview)" pos:[10,140] width:280 height:22 enabled:false
	timer tmrSelection interval:500 active:true

	fn getTargets =
	(
		local selectedNodes = selection as array
		local targets = #()
		local seenBases = #()
		for obj in selectedNodes where isKindOf obj Editable_Poly do
		(
			local base = obj.baseObject
			if (findItem seenBases base) > 0 then continue
			append seenBases base
			-- 위 modifier의 정점 인덱스와 비선택 인스턴스를 손상시키지 않는다.
			local safe = (obj.modifiers.count == 0)
			for dependent in (refs.dependentNodes base) do
			(
				if (findItem selectedNodes dependent) == 0 then safe = false
				if dependent.modifiers.count > 0 then safe = false
			)
			if safe do append targets obj
		)
		targets
	)

	fn liveVertCount obj =
	(
		(polyop.getNumVerts obj) - (polyop.getDeadVerts obj).numberSet
	)

	fn getCollinearVerts obj thresh =
	(
		local toRemove = #{}
		local numVerts = polyop.getNumVerts obj
		local faceRemaining = for f = 1 to (polyop.getNumFaces obj) collect
			(if polyop.isFaceDead obj f then 0 else (polyop.getFaceVerts obj f).count)
		for i = 1 to numVerts do
		(
			if polyop.isVertDead obj i then continue
			local edges = polyop.getEdgesUsingVert obj i
			if edges.numberSet == 2 then
			(
				local edgeList = #()
				for e in edges do append edgeList e
				local ev1 = polyop.getEdgeVerts obj edgeList[1]
				local ev2 = polyop.getEdgeVerts obj edgeList[2]
				local neighbors = #()
				for v in ev1 do if v != i then append neighbors v
				for v in ev2 do if v != i then append neighbors v
				if neighbors.count == 2 and neighbors[1] != neighbors[2] then
				(
					local p0, p1, p2
					in coordsys world
					(
						p0 = polyop.getVert obj i
						p1 = polyop.getVert obj neighbors[1]
						p2 = polyop.getVert obj neighbors[2]
					)
					local segment = p2 - p1
					local segmentSq = dot segment segment
					-- 영길이 이웃과 선분 연장선 위의 끝점은 잉여 정점이 아니다.
					if segmentSq <= 0.0 then continue
					local fraction = (dot (p0 - p1) segment) / segmentSq
					if fraction <= 0.0 or fraction >= 1.0 then continue
					local dist = length (p0 - (p1 + segment * fraction))
					if dist < thresh then
					(
						local faces = polyop.getFacesUsingVert obj i
						local safe = (faces.numberSet > 0)
						-- 한 번에 여러 정점을 제거해도 각 면에 최소 3점을 남긴다.
						for f in faces where faceRemaining[f] <= 3 do safe = false
						if safe then
						(
							append toRemove i
							for f in faces do faceRemaining[f] -= 1
						)
					)
				)
			)
		)
		toRemove
	)

	fn updateInfo =
	(
		local targets = getTargets()
		if selection.count == 0 then
		(
			lblInfo.text = "No object selected."
			lblDetail.text = ""
			btnRun.enabled = false
			btnSelect.enabled = false
		)
		else if selection.count > 1 then
		(
			lblInfo.text = (selection.count as string + " selected; " + targets.count as string + " eligible base objects")
			lblDetail.text = "No modifiers; select all shared instances."
			btnRun.enabled = (targets.count > 0)
			btnSelect.enabled = false
		)
		else if not isKindOf $ Editable_Poly then
		(
			lblInfo.text = ("'" + $.name + "' is not an Editable Poly.")
			lblDetail.text = "Convert to Editable Poly first."
			btnRun.enabled = false
			btnSelect.enabled = false
		)
		else if targets.count == 0 then
		(
			lblInfo.text = "Target skipped: modifiers or shared geometry."
			lblDetail.text = "No modifiers; select all shared instances."
			btnRun.enabled = false
			btnSelect.enabled = false
		)
		else
		(
			lblInfo.text = ("Target: " + $.name)
			lblDetail.text = ("Whole object | Verts: " + (liveVertCount $) as string)
			btnRun.enabled = true
			btnSelect.enabled = true
		)
	)

	on RemoveCollinearVerts open do updateInfo()

	on tmrSelection tick do
	(
		try (updateInfo()) catch
		(
			lblInfo.text = "Cannot read the current selection."
			lblDetail.text = ""
			btnRun.enabled = false
			btnSelect.enabled = false
		)
	)

	on btnSelect pressed do
	(
		local targets = getTargets()
		if selection.count == 1 and targets.count == 1 do
		(
			local obj = targets[1]
			local verts = getCollinearVerts obj spnThresh.value
			undo "Preview Collinear Verts" on (polyop.setVertSelection obj verts)
			modPanel.setCurrentObject obj.baseObject node:obj ui:true
			subObjectLevel = 1
			redrawViews()
			lblInfo.text = (verts.numberSet as string + " collinear verts found.")
			lblDetail.text = "Preview mode - verts selected."
		)
	)

	on btnRun pressed do
	(
		local objs = getTargets()
		if objs.count == 0 then
		(
			messageBox "Select Editable Poly objects with no modifiers. All nodes sharing their geometry must be selected." title:"Notice"
			return undefined
		)

		local totalRemoved = 0
		local thresh = spnThresh.value
		local plans = #()

		try
		(
			-- 모든 대상의 읽기/검사를 끝낸 다음 씬 수정을 시작한다.
			for obj in objs do append plans (getCollinearVerts obj thresh)
			undo "Remove Collinear Verts" on
			(
				for n = 1 to objs.count do
				(
					local obj = objs[n]
					local verts = plans[n]
					if verts.numberSet > 0 do
					(
						local beforeCount = liveVertCount obj
						polyop.setVertSelection obj verts
						-- 기본값 #CurrentLevel은 Edge/Face를 제거할 수 있다.
						if not (obj.EditablePoly.Remove selLevel:#Vertex) do
							throw ("Remove failed on " + obj.name)
						totalRemoved += beforeCount - (liveVertCount obj)
					)
				)
			)
		)
		catch
		(
			messageBox ("Remove stopped. If the scene changed, use Undo (Remove Collinear Verts) to restore it.\n" + getCurrentException()) title:"Remove Collinear Vertices"
			return undefined
		)

		redrawViews()

		-- 결과 메시지
		local msg = ""
		if totalRemoved > 0 then
		(
			msg = totalRemoved as string + " vertices removed.\n"
			msg += objs.count as string + " eligible base object(s) processed."
			if objs.count == 1 and isKindOf $ Editable_Poly then
				msg += ("\nRemaining verts: " + (liveVertCount $) as string)
		)
		else
			msg = "No collinear vertices found.\n(Threshold: " + thresh as string + ")"

		messageBox msg title:"Remove Collinear Vertices"
		updateInfo()
	)
)

createDialog RemoveCollinearVerts
