import {
  useRef,
  useState,
} from "react";


const SCALE = 30;

const AUTO_PAN_EDGE = 60;
const AUTO_PAN_SPEED = 12;

/*
 * Mouse ต้องขยับเกินค่านี้
 * ขณะที่ยัง HOLD อยู่
 * ถึงจะเริ่ม Drag
 */
const DRAG_THRESHOLD = 6;


export default function MapCanvas({
  mapData,

  mode,
  tool,

  selectedNodeId,
  selectedEdgeId,

  connectionStart,

  robots = [],

  selectedRobotId,
  onRobotClick,

  zoom,
  onZoomChange,

  onCanvasClick,

  onNodeClick,
  onNodeMove,

  onNodeDragStart,
  onNodeDragEnd,

  onEdgeClick,
}) {
  /*
   * =====================================================
   * REFS
   * =====================================================
   */

  const viewportRef =
    useRef(null);

  const panRef =
    useRef({
      x: 220,
      y: 150,
    });

  const panDragRef =
    useRef(null);

  /*
   * Node drag session
   *
   * null = ตอนนี้ไม่ได้ HOLD node
   */
  const nodeDragRef =
    useRef(null);

  const autoPanFrameRef =
    useRef(null);

  const movedRef =
    useRef(false);

  /*
   * Last pointer location
   * ตอนกำลัง drag node
   */
  const dragPointerRef =
    useRef(null);


  /*
   * =====================================================
   * STATE
   * =====================================================
   */

  const [
    pan,
    setPan,
  ] = useState({
    x: 220,
    y: 150,
  });


  /*
   * =====================================================
   * PAN UPDATE
   * =====================================================
   */

  function updatePan(
    nextPan
  ) {
    panRef.current =
      nextPan;

    setPan(
      nextPan
    );
  }


  /*
   * =====================================================
   * SCREEN -> WORLD
   * =====================================================
   */

  function screenToWorld(
    clientX,
    clientY
  ) {
    const viewport =
      viewportRef.current;

    if (!viewport) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      viewport.getBoundingClientRect();

    const screenX =
      clientX -
      rect.left;

    const screenY =
      clientY -
      rect.top;

    const worldPixelX =
      (
        screenX -
        panRef.current.x
      ) /
      zoom;

    const worldPixelY =
      (
        screenY -
        panRef.current.y
      ) /
      zoom;

    return {
      x: Number(
        (
          worldPixelX /
          SCALE
        ).toFixed(3)
      ),

      y: Number(
        (
          worldPixelY /
          SCALE
        ).toFixed(3)
      ),
    };
  }


  /*
   * =====================================================
   * AUTO PAN
   * =====================================================
   */

  function calculateAutoPan(
    clientX,
    clientY
  ) {
    const viewport =
      viewportRef.current;

    if (!viewport) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      viewport.getBoundingClientRect();

    let moveX = 0;
    let moveY = 0;


    /*
     * LEFT
     */

    if (
      clientX -
        rect.left <
      AUTO_PAN_EDGE
    ) {
      moveX =
        AUTO_PAN_SPEED;
    }


    /*
     * RIGHT
     */

    if (
      rect.right -
        clientX <
      AUTO_PAN_EDGE
    ) {
      moveX =
        -AUTO_PAN_SPEED;
    }


    /*
     * TOP
     */

    if (
      clientY -
        rect.top <
      AUTO_PAN_EDGE
    ) {
      moveY =
        AUTO_PAN_SPEED;
    }


    /*
     * BOTTOM
     */

    if (
      rect.bottom -
        clientY <
      AUTO_PAN_EDGE
    ) {
      moveY =
        -AUTO_PAN_SPEED;
    }


    return {
      x: moveX,
      y: moveY,
    };
  }


  function startAutoPan() {
    if (
      autoPanFrameRef.current
    ) {
      return;
    }


    function loop() {
      const drag =
        nodeDragRef.current;

      const pointer =
        dragPointerRef.current;


      /*
       * ถ้าไม่ได้ drag อยู่
       * หรือ mouse ไม่ได้ down แล้ว
       * หยุดทันที
       */

      if (
        !drag ||
        !drag.dragging ||
        !pointer
      ) {
        autoPanFrameRef.current =
          null;

        return;
      }


      const movement =
        calculateAutoPan(
          pointer.clientX,
          pointer.clientY
        );


      if (
        movement.x !== 0 ||
        movement.y !== 0
      ) {
        updatePan({
          x:
            panRef.current.x +
            movement.x,

          y:
            panRef.current.y +
            movement.y,
        });


        /*
         * map ขยับแล้ว
         * ต้องคำนวณ Node ใหม่
         */

        updateDraggedNodePosition();
      }


      autoPanFrameRef.current =
        requestAnimationFrame(
          loop
        );
    }


    autoPanFrameRef.current =
      requestAnimationFrame(
        loop
      );
  }


  function stopAutoPan() {
    dragPointerRef.current =
      null;


    if (
      autoPanFrameRef.current
    ) {
      cancelAnimationFrame(
        autoPanFrameRef.current
      );

      autoPanFrameRef.current =
        null;
    }
  }


  /*
   * =====================================================
   * BACKGROUND PAN
   * =====================================================
   */

  function handleBackgroundPointerDown(
    event
  ) {
    /*
     * ถ้า event มาจาก Node/Path
     * stopPropagation จะกันไว้ก่อนถึงตรงนี้
     */

    const middleMouse =
      event.button === 1;

    const leftPan =
      event.button === 0 &&
      (
        tool === "select" ||
        mode === "monitor"
      );


    if (
      !middleMouse &&
      !leftPan
    ) {
      return;
    }


    event.preventDefault();


    movedRef.current =
      false;


    panDragRef.current = {
      pointerId:
        event.pointerId,

      startX:
        event.clientX,

      startY:
        event.clientY,

      originalPanX:
        panRef.current.x,

      originalPanY:
        panRef.current.y,
    };


    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {
      //
    }
  }


  function handleBackgroundPointerMove(
    event
  ) {
    const drag =
      panDragRef.current;


    if (!drag) {
      return;
    }


    if (
      drag.pointerId !==
      event.pointerId
    ) {
      return;
    }


    const dx =
      event.clientX -
      drag.startX;

    const dy =
      event.clientY -
      drag.startY;


    if (
      Math.abs(dx) > 3 ||
      Math.abs(dy) > 3
    ) {
      movedRef.current =
        true;
    }


    updatePan({
      x:
        drag.originalPanX +
        dx,

      y:
        drag.originalPanY +
        dy,
    });
  }


  function handleBackgroundPointerUp(
    event
  ) {
    const drag =
      panDragRef.current;


    /*
     * ถ้าไม่ได้เริ่ม background interaction
     * ไม่ต้องทำอะไร
     */

    if (!drag) {
      return;
    }


    if (
      drag.pointerId !==
      event.pointerId
    ) {
      return;
    }


    panDragRef.current =
      null;


    /*
     * ถ้ามีการลากจริง
     * = เป็น Pan
     * ไม่ clear selection
     */

    if (
      movedRef.current
    ) {
      movedRef.current =
        false;

      return;
    }


    /*
     * Click พื้นที่ว่างจริง
     */

    if (
      event.button !== 0
    ) {
      return;
    }


    const position =
      screenToWorld(
        event.clientX,
        event.clientY
      );


    onCanvasClick(
      position
    );
  }


  /*
   * =====================================================
   * ZOOM
   * =====================================================
   */

  function handleWheel(
    event
  ) {
    event.preventDefault();


    const viewport =
      viewportRef.current;


    if (!viewport) {
      return;
    }


    const rect =
      viewport.getBoundingClientRect();


    const mouseX =
      event.clientX -
      rect.left;

    const mouseY =
      event.clientY -
      rect.top;


    const oldZoom =
      zoom;


    const factor =
      event.deltaY < 0
        ? 1.1
        : 0.9;


    const nextZoom =
      clamp(
        oldZoom *
          factor,
        0.25,
        4
      );


    const worldX =
      (
        mouseX -
        panRef.current.x
      ) /
      oldZoom;

    const worldY =
      (
        mouseY -
        panRef.current.y
      ) /
      oldZoom;


    updatePan({
      x:
        mouseX -
        worldX *
          nextZoom,

      y:
        mouseY -
        worldY *
          nextZoom,
    });


    onZoomChange(
      Number(
        nextZoom.toFixed(3)
      )
    );
  }


  /*
   * =====================================================
   * NODE POINTER DOWN
   *
   * จุดสำคัญ:
   *
   * pointerDown = SELECT เท่านั้นก่อน
   *
   * Node จะยังไม่ขยับ
   * จนกว่า mouse ยัง hold และ move > threshold
   * =====================================================
   */

  function handleNodePointerDown(
    event,
    node
  ) {
    event.stopPropagation();


    /*
     * MONITOR
     */

    if (
      mode === "monitor"
    ) {
      return;
    }


    /*
     * CONNECT MODE
     */

    if (
      tool === "connect"
    ) {
      event.preventDefault();


      onNodeClick(
        node.id
      );

      return;
    }


    /*
     * SELECT MODE ONLY
     */

    if (
      tool !== "select"
    ) {
      return;
    }


    if (
      event.button !== 0
    ) {
      return;
    }


    event.preventDefault();


    /*
     * ===============================================
     * CLICK = SELECT NODE
     * ===============================================
     */

    onNodeClick(
      node.id
    );


    /*
     * ===============================================
     * เริ่ม HOLD SESSION
     *
     * ยังไม่ได้ drag
     * ===============================================
     */

    nodeDragRef.current = {
      pointerId:
        event.pointerId,

      nodeId:
        node.id,

      startClientX:
        event.clientX,

      startClientY:
        event.clientY,

      dragging:
        false,

      pointerIsDown:
        true,
    };


    /*
     * Pointer Capture สำคัญมาก
     *
     * หลังจากกด node
     * move/up จะถูกส่งกลับมาที่ node นี้
     * เฉพาะจนกว่าจะปล่อย mouse
     */

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {
      //
    }
  }


  /*
   * =====================================================
   * NODE POINTER MOVE
   *
   * สำคัญ:
   * function นี้จะทำงานเฉพาะระหว่าง pointer down
   * เพราะใช้ pointer capture
   * =====================================================
   */

  function handleNodePointerMove(
    event,
    node
  ) {
    event.stopPropagation();


    const drag =
      nodeDragRef.current;


    /*
     * ไม่มี hold session
     *
     * = ขยับ mouse เฉย ๆ
     * Node ห้ามขยับ
     */

    if (!drag) {
      return;
    }


    /*
     * pointer คนละตัว
     */

    if (
      drag.pointerId !==
      event.pointerId
    ) {
      return;
    }


    /*
     * ต้องยังอยู่ในสถานะ pointer down
     */

    if (
      !drag.pointerIsDown
    ) {
      return;
    }


    /*
     * ต้องเป็น Node เดิม
     */

    if (
      drag.nodeId !==
      node.id
    ) {
      return;
    }


    const dx =
      event.clientX -
      drag.startClientX;

    const dy =
      event.clientY -
      drag.startClientY;


    const distance =
      Math.sqrt(
        dx * dx +
        dy * dy
      );


    /*
     * ===============================================
     * ยังไม่ถึง threshold
     *
     * = แค่ click / hold
     *
     * Node ยังห้ามขยับ
     * ===============================================
     */

    if (
      !drag.dragging &&
      distance <
        DRAG_THRESHOLD
    ) {
      return;
    }


    /*
     * ===============================================
     * START DRAG
     * ===============================================
     */

    if (
      !drag.dragging
    ) {
      drag.dragging =
        true;


      nodeDragRef.current =
        drag;


      onNodeDragStart?.(
        node.id
      );
    }


    /*
     * Pointer location
     * สำหรับ move + auto pan
     */

    dragPointerRef.current = {
      clientX:
        event.clientX,

      clientY:
        event.clientY,
    };


    /*
     * Move Node
     */

    updateDraggedNodePosition();


    /*
     * Auto-pan
     */

    startAutoPan();
  }


  /*
   * =====================================================
   * UPDATE CURRENT DRAGGED NODE
   * =====================================================
   */

  function updateDraggedNodePosition() {
    const drag =
      nodeDragRef.current;

    const pointer =
      dragPointerRef.current;


    if (
      !drag ||
      !drag.dragging ||
      !pointer
    ) {
      return;
    }


    const position =
      screenToWorld(
        pointer.clientX,
        pointer.clientY
      );


    const snapped =
      snapToGrid(
        position,
        mapData.gridSpacing
      );


    onNodeMove(
      drag.nodeId,
      snapped.x,
      snapped.y
    );
  }


  /*
   * =====================================================
   * NODE POINTER UP
   *
   * พอปล่อย:
   *
   * hold session ถูกลบทิ้งทันที
   *
   * จากนั้นขยับ mouse ไปไหนก็ไม่สามารถลาก Node ได้
   * =====================================================
   */

  function handleNodePointerUp(
    event,
    node
  ) {
    event.stopPropagation();


    const drag =
      nodeDragRef.current;


    if (!drag) {
      return;
    }


    if (
      drag.pointerId !==
      event.pointerId
    ) {
      return;
    }


    /*
     * pointer ไม่ down แล้ว
     */

    drag.pointerIsDown =
      false;


    /*
     * ถ้าลากจริง
     * ปิด history transaction
     */

    if (
      drag.dragging
    ) {
      stopAutoPan();


      onNodeDragEnd?.(
        node.id
      );
    }


    /*
     * สำคัญมาก
     *
     * ลบ drag session
     *
     * เพราะฉะนั้นหลังจาก Mouse Up
     * ต่อให้ขยับ mouse
     * Node ก็ไม่สามารถขยับอีก
     */

    nodeDragRef.current =
      null;


    dragPointerRef.current =
      null;


    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    } catch {
      //
    }
  }


  /*
   * =====================================================
   * NODE POINTER CANCEL
   * =====================================================
   */

  function handleNodePointerCancel(
    event,
    node
  ) {
    event.stopPropagation();


    const drag =
      nodeDragRef.current;


    if (
      drag?.dragging
    ) {
      onNodeDragEnd?.(
        node.id
      );
    }


    stopAutoPan();


    nodeDragRef.current =
      null;

    dragPointerRef.current =
      null;
  }


  /*
   * =====================================================
   * PATH CLICK
   * =====================================================
   */

  function handleEdgePointerDown(
    event,
    edge
  ) {
    event.stopPropagation();


    if (
      mode !== "edit" ||
      tool !== "select"
    ) {
      return;
    }


    if (
      event.button !== 0
    ) {
      return;
    }


    event.preventDefault();


    /*
     * Path ไม่มี drag
     *
     * Click ครั้งเดียว = select
     */

    onEdgeClick(
      edge.id
    );
  }


  /*
   * =====================================================
   * ROBOT CLICK
   * =====================================================
   */

  function handleRobotPointerDown(
    event,
    robotId
  ) {
    event.stopPropagation();


    if (
      mode !== "monitor"
    ) {
      return;
    }


    onRobotClick(
      robotId
    );
  }


  /*
   * =====================================================
   * ROBOT PATH
   * =====================================================
   */

  const selectedRobot =
    robots.find(
      (robot) =>
        robot.id ===
        selectedRobotId
    ) || null;


  const selectedRobotPath =
    selectedRobot?.plannedPath ||
    [];


  /*
   * =====================================================
   * GRID SIZE
   * =====================================================
   */

  const gridSize =
    Math.max(
      Number(
        mapData.gridSpacing
      ) || 1,
      0.01
    ) *
    SCALE *
    zoom;


  /*
   * =====================================================
   * RENDER
   * =====================================================
   */

  return (
    <div
      ref={
        viewportRef
      }

      className={`map-canvas-wrapper tool-${tool}`}

      onPointerDown={
        handleBackgroundPointerDown
      }

      onPointerMove={
        handleBackgroundPointerMove
      }

      onPointerUp={
        handleBackgroundPointerUp
      }

      onPointerCancel={() => {
        panDragRef.current =
          null;

        stopAutoPan();
      }}

      onWheel={
        handleWheel
      }
    >

      {/* =================================================
          GRID
      ================================================= */}

      <div
        className="infinite-map-background"

        style={{
          "--grid-size":
            `${gridSize}px`,

          "--grid-x":
            `${positiveModulo(
              pan.x,
              gridSize
            )}px`,

          "--grid-y":
            `${positiveModulo(
              pan.y,
              gridSize
            )}px`,
        }}
      />


      {/* =================================================
          WORLD
      ================================================= */}

      <svg
        className="infinite-map-world"
      >

        <defs>

          <marker
            id="path-arrow"

            markerWidth="8"
            markerHeight="8"

            refX="7"
            refY="4"

            orient="auto"

            markerUnits="strokeWidth"
          >

            <path
              d="M 0 0 L 8 4 L 0 8 z"

              className="path-arrow-head"
            />

          </marker>

        </defs>


        <g
          transform={`
            translate(
              ${pan.x}
              ${pan.y}
            )

            scale(
              ${zoom}
            )
          `}
        >

          {/* =============================================
              BOUNDARY
          ============================================= */}

          <rect
            x="0"
            y="0"

            width={
              mapData.width *
              SCALE
            }

            height={
              mapData.height *
              SCALE
            }

            className="warehouse-boundary"
          />


          {/* =============================================
              PATHS
          ============================================= */}

          {mapData.edges.map(
            (edge) => {
              const from =
                mapData.nodes.find(
                  (node) =>
                    node.id ===
                    edge.from
                );


              const to =
                mapData.nodes.find(
                  (node) =>
                    node.id ===
                    edge.to
                );


              if (
                !from ||
                !to
              ) {
                return null;
              }


              const x1 =
                from.x *
                SCALE;

              const y1 =
                from.y *
                SCALE;

              const x2 =
                to.x *
                SCALE;

              const y2 =
                to.y *
                SCALE;


              const selected =
                mode === "edit" &&
                selectedEdgeId ===
                  edge.id;


              const highlighted =
                mode === "monitor" &&
                isEdgeInRobotPath(
                  edge,
                  selectedRobotPath
                );


              const pathType =
                edge.pathType ||
                "NORMAL";


              return (
                <g
                  key={
                    edge.id
                  }

                  className="map-edge-group"
                >

                  {/* HITBOX */}

                  {mode ===
                    "edit" && (

                    <line
                      x1={x1}
                      y1={y1}

                      x2={x2}
                      y2={y2}

                      className="map-edge-hitbox"

                      onPointerDown={(
                        event
                      ) =>
                        handleEdgePointerDown(
                          event,
                          edge
                        )
                      }

                      onPointerUp={(
                        event
                      ) =>
                        event.stopPropagation()
                      }
                    />

                  )}


                  {/* REAL PATH */}

                  <line
                    x1={x1}
                    y1={y1}

                    x2={x2}
                    y2={y2}

                    markerEnd={
                      !edge.bidirectional
                        ? "url(#path-arrow)"
                        : undefined
                    }

                    className={[
                      "map-edge",

                      `path-type-${pathType.toLowerCase()}`,

                      selected
                        ? "selected"
                        : "",

                      highlighted
                        ? "path-highlighted"
                        : "",

                      edge.enabled === false
                        ? "disabled"
                        : "",
                    ].join(" ")}
                  />


                  <text
                    x={
                      (
                        x1 +
                        x2
                      ) /
                      2
                    }

                    y={
                      (
                        y1 +
                        y2
                      ) /
                        2 -
                      9
                    }

                    textAnchor="middle"

                    className="edge-distance"
                  >
                    {edge.id}

                    {" • "}

                    {Number(
                      edge.distance
                    ).toFixed(2)}

                    {" m"}
                  </text>

                </g>
              );
            }
          )}


          {/* =============================================
              NODES
          ============================================= */}

          {mapData.nodes.map(
            (node) => {
              const selected =
                mode === "edit" &&
                selectedNodeId ===
                  node.id;


              const connecting =
                mode === "edit" &&
                connectionStart ===
                  node.id;


              return (
                <NodeShape
                  key={
                    node.id
                  }

                  node={
                    node
                  }

                  selected={
                    selected
                  }

                  connecting={
                    connecting
                  }

                  onPointerDown={(
                    event
                  ) =>
                    handleNodePointerDown(
                      event,
                      node
                    )
                  }

                  onPointerMove={(
                    event
                  ) =>
                    handleNodePointerMove(
                      event,
                      node
                    )
                  }

                  onPointerUp={(
                    event
                  ) =>
                    handleNodePointerUp(
                      event,
                      node
                    )
                  }

                  onPointerCancel={(
                    event
                  ) =>
                    handleNodePointerCancel(
                      event,
                      node
                    )
                  }
                />
              );
            }
          )}


          {/* =============================================
              ROBOTS
          ============================================= */}

          {mode ===
            "monitor" &&
            robots.map(
              (robot) => {
                const selected =
                  selectedRobotId ===
                  robot.id;


                return (
                  <g
                    key={
                      robot.id
                    }

                    className="monitor-robot"

                    transform={`
                      translate(
                        ${
                          robot.x *
                          SCALE
                        }

                        ${
                          robot.y *
                          SCALE
                        }
                      )
                    `}

                    onPointerDown={(
                      event
                    ) =>
                      handleRobotPointerDown(
                        event,
                        robot.id
                      )
                    }

                    onPointerUp={(
                      event
                    ) =>
                      event.stopPropagation()
                    }
                  >

                    <circle
                      r={
                        selected
                          ? 16
                          : 13
                      }

                      className={[
                        "monitor-robot-body",

                        `status-${robot.status.toLowerCase()}`,

                        selected
                          ? "selected"
                          : "",
                      ].join(" ")}
                    />


                    <text
                      x="0"
                      y="4"

                      textAnchor="middle"

                      className="monitor-robot-symbol"
                    >
                      R
                    </text>


                    <text
                      x="0"
                      y="-20"

                      textAnchor="middle"

                      className="monitor-robot-label"
                    >
                      {robot.id}
                    </text>

                  </g>
                );
              }
            )}

        </g>

      </svg>


      {/* =================================================
          ORIGIN
      ================================================= */}

      <div
        className="map-origin-marker"

        style={{
          left:
            pan.x,

          top:
            pan.y,
        }}
      >
        <span>
          0,0
        </span>
      </div>

    </div>
  );
}


/*
 * =====================================================
 * NODE SHAPE
 * =====================================================
 */

function NodeShape({
  node,

  selected,
  connecting,

  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}) {
  const x =
    node.x *
    SCALE;

  const y =
    node.y *
    SCALE;


  const classes = [
    "map-node-shape",

    `node-type-${node.type.toLowerCase()}`,

    selected
      ? "selected"
      : "",

    connecting
      ? "connecting"
      : "",

    node.enabled === false
      ? "disabled"
      : "",
  ].join(" ");


  /*
   * ===================================================
   * STORAGE
   * ===================================================
   */

  if (
    node.type === "STORAGE"
  ) {
    const width =
      Number(
        node.config?.width ||
          4
      ) *
      SCALE;

    const depth =
      Number(
        node.config?.depth ||
          2
      ) *
      SCALE;


    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )

          rotate(
            ${
              node.rotation ||
              0
            }
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >

        <rect
          x={
            -width /
            2
          }

          y={
            -depth /
            2
          }

          width={
            width
          }

          height={
            depth
          }

          rx="5"

          className={
            classes
          }
        />


        <LocalNodeLabel
          node={
            node
          }
        />

      </g>
    );
  }


  /*
   * ===================================================
   * CHARGING / DOCK
   * ===================================================
   */

  if (
    node.type ===
      "CHARGING" ||
    node.type ===
      "DOCK"
  ) {
    const width =
      Number(
        node.config?.width ||
          2
      ) *
      SCALE;

    const depth =
      Number(
        node.config?.depth ||
          2
      ) *
      SCALE;


    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )

          rotate(
            ${
              node.rotation ||
              0
            }
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >

        <rect
          x={
            -width /
            2
          }

          y={
            -depth /
            2
          }

          width={
            width
          }

          height={
            depth
          }

          rx="7"

          className={
            classes
          }
        />


        <text
          x="0"
          y="4"

          textAnchor="middle"

          className="node-type-symbol"
        >
          {node.type ===
          "CHARGING"
            ? "⚡"
            : "D"}
        </text>


        <LocalNodeLabel
          node={
            node
          }
        />

      </g>
    );
  }


  /*
   * ===================================================
   * ROAD
   * ===================================================
   */

  if (
    node.type === "ROAD"
  ) {
    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )

          rotate(
            ${
              45 +
              (
                node.rotation ||
                0
              )
            }
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >

        <rect
          x="-10"
          y="-10"

          width="20"
          height="20"

          rx="3"

          className={
            classes
          }
        />

      </g>
    );
  }


  /*
   * ===================================================
   * PICKUP / DROPOFF
   * ===================================================
   */

  if (
    node.type ===
      "PICKUP" ||
    node.type ===
      "DROPOFF"
  ) {
    const points =
      node.type ===
      "PICKUP"
        ? "-12,10 0,-12 12,10"
        : "-12,-10 0,12 12,-10";


    return (
      <g
        className="map-node-group"

        transform={`
          translate(
            ${x}
            ${y}
          )
        `}

        onPointerDown={
          onPointerDown
        }

        onPointerMove={
          onPointerMove
        }

        onPointerUp={
          onPointerUp
        }

        onPointerCancel={
          onPointerCancel
        }
      >

        <polygon
          points={
            points
          }

          className={
            classes
          }
        />


        <LocalNodeLabel
          node={
            node
          }
        />

      </g>
    );
  }


  /*
   * ===================================================
   * WAYPOINT / HOME / WAITING
   * ===================================================
   */

  return (
    <g
      className="map-node-group"

      onPointerDown={
        onPointerDown
      }

      onPointerMove={
        onPointerMove
      }

      onPointerUp={
        onPointerUp
      }

      onPointerCancel={
        onPointerCancel
      }
    >

      <circle
        cx={
          x
        }

        cy={
          y
        }

        r={
          selected ||
          connecting
            ? 10
            : 8
        }

        className={
          classes
        }
      />


      {node.type ===
        "HOME" && (

        <text
          x={
            x
          }

          y={
            y + 3
          }

          textAnchor="middle"

          className="node-type-symbol"
        >
          H
        </text>

      )}


      <text
        x={
          x
        }

        y={
          y - 15
        }

        textAnchor="middle"

        className="map-node-label"
      >
        {node.id}
      </text>

    </g>
  );
}


/*
 * =====================================================
 * LOCAL NODE LABEL
 * =====================================================
 */

function LocalNodeLabel({
  node,
}) {
  return (
    <text
      x="0"
      y="-18"

      textAnchor="middle"

      className="map-node-label"
    >
      {node.id}
    </text>
  );
}


/*
 * =====================================================
 * SNAP
 * =====================================================
 */

function snapToGrid(
  position,
  spacing
) {
  const step =
    Number(
      spacing
    );


  if (
    !Number.isFinite(
      step
    ) ||
    step <= 0
  ) {
    return position;
  }


  return {
    x: Number(
      (
        Math.round(
          position.x /
          step
        ) *
        step
      ).toFixed(3)
    ),

    y: Number(
      (
        Math.round(
          position.y /
          step
        ) *
        step
      ).toFixed(3)
    ),
  };
}


/*
 * =====================================================
 * CLAMP
 * =====================================================
 */

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    Math.max(
      Number(value),
      min
    ),
    max
  );
}


/*
 * =====================================================
 * MODULO
 * =====================================================
 */

function positiveModulo(
  value,
  divisor
) {
  if (
    !Number.isFinite(
      divisor
    ) ||
    divisor <= 0
  ) {
    return 0;
  }


  return (
    (
      value %
      divisor
    ) +
    divisor
  ) %
  divisor;
}


/*
 * =====================================================
 * ROBOT PATH CHECK
 * =====================================================
 */

function isEdgeInRobotPath(
  edge,
  path
) {
  if (
    !path ||
    path.length < 2
  ) {
    return false;
  }


  for (
    let index = 0;
    index <
    path.length - 1;
    index++
  ) {
    const from =
      path[index];

    const to =
      path[
        index + 1
      ];


    if (
      (
        edge.from === from &&
        edge.to === to
      ) ||
      (
        edge.from === to &&
        edge.to === from
      )
    ) {
      return true;
    }
  }


  return false;
}