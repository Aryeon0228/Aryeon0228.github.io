/*
	Remove Collinear Vertices
	선택한 오브젝트의 잉여 버텍스를 제거하는 스크립트
*/

try(destroyDialog RemoveCollinearVerts) catch()

rollout RemoveCollinearVerts "Remove Collinear Vertices" width:300 height:200
(
	spinner spnThresh "Threshold:" range:[0.0001, 10.0, 0.001] type:#float scale:0.001 pos:[10,15] width:280
	label lblInfo "" pos:[10,50]
	label lblDetail "" pos:[10,68]
	button btnRun "Remove" pos:[10,95] width:280 height:40 enabled:false
	button btnSelect "Select Verts (Preview)" pos:[10,140] width:280 height:22 enabled:false
	timer tmrSelection interval:500 active:true

	fn getCollinearVerts obj thresh =
	(
		local toRemove = #{}
		local numVerts = polyop.getNumVerts obj
		for i = 1 to numVerts do
		(
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
				if neighbors.count == 2 then
				(
					local p0 = polyop.getVert obj i
					local p1 = polyop.getVert obj neighbors[1]
					local p2 = polyop.getVert obj neighbors[2]
					local dir = normalize (p2 - p1)
					local dist = length ((p0 - p1) - dir * (dot (p0 - p1) dir))
					if dist < thresh then append toRemove i
				)
			)
		)
		toRemove
	)

	fn updateInfo =
	(
		if selection.count == 0 then
		(
			lblInfo.text = "No object selected."
			lblDetail.text = ""
			btnRun.enabled = false
			btnSelect.enabled = false
		)
		else if selection.count > 1 then
		(
			local polyCount = (for obj in selection where isKindOf obj Editable_Poly collect obj).count
			lblInfo.text = (selection.count as string + " objects selected (" + polyCount as string + " Editable Poly)")
			lblDetail.text = ""
			btnRun.enabled = (polyCount > 0)
			btnSelect.enabled = false
		)
		else if not isKindOf $ Editable_Poly then
		(
			lblInfo.text = ("'" + $.name + "' is not an Editable Poly.")
			lblDetail.text = "Convert to Editable Poly first."
			btnRun.enabled = false
			btnSelect.enabled = false
		)
		else
		(
			lblInfo.text = ("Target: " + $.name)
			lblDetail.text = ("Verts: " + (polyop.getNumVerts $) as string + "  |  Faces: " + (polyop.getNumFaces $) as string)
			btnRun.enabled = true
			btnSelect.enabled = true
		)
	)

	on RemoveCollinearVerts open do updateInfo()

	on tmrSelection tick do updateInfo()

	on btnSelect pressed do
	(
		if selection.count == 1 and isKindOf $ Editable_Poly do
		(
			local verts = getCollinearVerts $ spnThresh.value
			polyop.setVertSelection $ verts
			subObjectLevel = 1
			lblInfo.text = (verts.numberSet as string + " collinear verts found.")
			lblDetail.text = "Preview mode - verts selected."
		)
	)

	on btnRun pressed do
	(
		local objs = for obj in selection where isKindOf obj Editable_Poly collect obj
		if objs.count == 0 then
		(
			messageBox "No Editable Poly objects in selection." title:"Notice"
			return undefined
		)

		local totalRemoved = 0
		local thresh = spnThresh.value

		undo "Remove Collinear Verts" on
		(
			for obj in objs do
			(
				local verts = getCollinearVerts obj thresh
				if verts.numberSet > 0 do
				(
					totalRemoved += verts.numberSet
					polyop.setVertSelection obj verts
					obj.Remove()
				)
			)
		)

		-- 완료 사운드
		windows.processPostedMessages()
		sysInfo.beep 1

		-- 결과 메시지
		local msg = ""
		if totalRemoved > 0 then
		(
			msg = totalRemoved as string + " vertices removed.\n"
			msg += objs.count as string + " object(s) processed."
			if objs.count == 1 and isKindOf $ Editable_Poly then
				msg += ("\nRemaining verts: " + (polyop.getNumVerts $) as string)
		)
		else
			msg = "No collinear vertices found.\n(Threshold: " + thresh as string + ")"

		messageBox msg title:"Remove Collinear Vertices"
		updateInfo()
	)
)

createDialog RemoveCollinearVerts
