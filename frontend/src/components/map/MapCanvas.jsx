import {
  useRef,
  useState,
} from "react";

const SCALE = 30;

const AUTO_PAN_EDGE = 60;
const AUTO_PAN_SPEED = 12;

export default function MapCanvas({
  mapData,

  mode,

  tool,

  selectedNodeId,
  selectedObject,
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

  onObjectClick,
  onObjectMove,

  onObjectDragStart,
  onObjectDragEnd,
}) {
  const viewportRef =
    useRef(null);

  const panRef =
    useRef({
      x: 220,
      y: 150,
    });

  const panDragRef =
    useRef(null);

  const movedRef =
    useRef(false);

  const autoPanFrameRef =
    useRef(null);

  const dragPointerRef =
    useRef(null);

  const [
    pan,
    setPan,
  ] = useState({
    x: 220,
    y: 150,
  });


  function updatePan(
    nextPan
  ) {
    panRef.current =
      nextPan;

    setPan(
      nextPan
    );
  }


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
   * =========================================
   * AUTO PAN
   * =========================================
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

    const leftDistance =
      clientX -
      rect.left;

    const rightDistance =
      rect.right -
      clientX;

    const topDistance =
      clientY -
      rect.top;

    const bottomDistance =
      rect.bottom -
      clientY;

    let moveX = 0;
    let moveY = 0;

    if (
      leftDistance <
      AUTO_PAN_EDGE
    ) {
      moveX =
        AUTO_PAN_SPEED;
    }

    if (
      rightDistance <
      AUTO_PAN_EDGE
    ) {
      moveX =
        -AUTO_PAN_SPEED;
    }

    if (
      topDistance <
      AUTO_PAN_EDGE
    ) {
      moveY =
        AUTO_PAN_SPEED;
    }

    if (
      bottomDistance <
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
      const pointer =
        dragPointerRef.current;

      if (!pointer) {
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

        pointer.updatePosition?.();
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
   * =========================================
   * BACKGROUND PAN
   * =========================================
   */

  function handleBackgroundPointerDown(
    event
  ) {
    const middleMouse =
      event.button === 1;

    const selectPan =
      event.button === 0 &&
      tool === "select";

    if (
      !middleMouse &&
      !selectPan
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
    const wasPanning =
      Boolean(
        panDragRef.current
      );

    panDragRef.current =
      null;

    if (
      wasPanning &&
      movedRef.current
    ) {
      movedRef.current =
        false;

      return;
    }

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
   * =========================================
   * ZOOM
   * =========================================
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

    const nextPan = {
      x:
        mouseX -
        worldX *
          nextZoom,

      y:
        mouseY -
        worldY *
          nextZoom,
    };

    updatePan(
      nextPan
    );

    onZoomChange(
      Number(
        nextZoom.toFixed(3)
      )
    );
  }


  /*
   * =========================================
   * NODE DRAG
   * =========================================
   */

  function handleNodePointerDown(
    event,
    node
  ) {
    event.stopPropagation();

    if (
      mode === "monitor"
    ) {
      return;
    }

    if (
      tool === "connect"
    ) {
      onNodeClick(
        node.id
      );

      return;
    }

    if (
      tool !== "select"
    ) {
      return;
    }

    event.preventDefault();

    onNodeClick(
      node.id
    );

    onNodeDragStart?.(
      node.id
    );

    const pointerId =
      event.pointerId;

    let moved =
      false;

    function updateNodePosition() {
      const pointer =
        dragPointerRef.current;

      if (!pointer) {
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
        node.id,
        snapped.x,
        snapped.y
      );
    }

    function handleMove(
      moveEvent
    ) {
      if (
        moveEvent.pointerId !==
        pointerId
      ) {
        return;
      }

      moved =
        true;

      dragPointerRef.current = {
        clientX:
          moveEvent.clientX,

        clientY:
          moveEvent.clientY,

        updatePosition:
          updateNodePosition,
      };

      updateNodePosition();

      startAutoPan();
    }

    function handleUp(
      upEvent
    ) {
      if (
        upEvent.pointerId !==
        pointerId
      ) {
        return;
      }

      window.removeEventListener(
        "pointermove",
        handleMove
      );

      window.removeEventListener(
        "pointerup",
        handleUp
      );

      stopAutoPan();

      if (moved) {
        movedRef.current =
          true;
      }

      onNodeDragEnd?.(
        node.id
      );
    }

    window.addEventListener(
      "pointermove",
      handleMove
    );

    window.addEventListener(
      "pointerup",
      handleUp
    );
  }


  /*
   * =========================================
   * OBJECT DRAG
   * =========================================
   */

  function handleObjectPointerDown(
    event,
    type,
    object
  ) {
    event.stopPropagation();

    if (
      mode === "monitor"
    ) {
      return;
    }

    if (
      tool !== "select"
    ) {
      return;
    }

    event.preventDefault();

    onObjectClick({
      type,
      id:
        object.id,
    });

    onObjectDragStart?.(
      type,
      object.id
    );

    const pointerId =
      event.pointerId;

    let moved =
      false;

    function updateObjectPosition() {
      const pointer =
        dragPointerRef.current;

      if (!pointer) {
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

      onObjectMove(
        type,
        object.id,
        snapped.x,
        snapped.y
      );
    }

    function handleMove(
      moveEvent
    ) {
      if (
        moveEvent.pointerId !==
        pointerId
      ) {
        return;
      }

      moved =
        true;

      dragPointerRef.current = {
        clientX:
          moveEvent.clientX,

        clientY:
          moveEvent.clientY,

        updatePosition:
          updateObjectPosition,
      };

      updateObjectPosition();

      startAutoPan();
    }

    function handleUp(
      upEvent
    ) {
      if (
        upEvent.pointerId !==
        pointerId
      ) {
        return;
      }

      window.removeEventListener(
        "pointermove",
        handleMove
      );

      window.removeEventListener(
        "pointerup",
        handleUp
      );

      stopAutoPan();

      if (moved) {
        movedRef.current =
          true;
      }

      onObjectDragEnd?.(
        type,
        object.id
      );
    }

    window.addEventListener(
      "pointermove",
      handleMove
    );

    window.addEventListener(
      "pointerup",
      handleUp
    );
  }


  const selectedRobot =
    robots.find(
      (robot) =>
        robot.id ===
        selectedRobotId
    ) || null;

  const selectedRobotPath =
    selectedRobot?.plannedPath ||
    [];


  const gridSize =
    Math.max(
      Number(
        mapData.gridSpacing
      ) || 1,
      0.01
    ) *
    SCALE *
    zoom;


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
      {/* GRID */}

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


      {/* WORLD */}

      <svg
        className="infinite-map-world"
      >
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

          {/* BOUNDARY */}

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


          {/* PATHS */}

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

              const highlighted =
                mode === "monitor" &&
                isEdgeInRobotPath(
                  edge,
                  selectedRobotPath
                );

              return (
                <g
                  key={
                    edge.id
                  }

                  className="map-edge-group"
                >
                  <line
                    x1={x1}
                    y1={y1}

                    x2={x2}
                    y2={y2}

                    className={
                      highlighted
                        ? "map-edge path-highlighted"
                        : "map-edge"
                    }
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
                    {Number(
                      edge.distance
                    ).toFixed(2)}
                    {" m"}
                  </text>
                </g>
              );
            }
          )}


          {/* RACKS */}

          {mapData.racks.map(
            (rack) => {
              const selected =
                mode === "edit" &&
                selectedObject?.type ===
                  "rack" &&
                selectedObject?.id ===
                  rack.id;

              return (
                <g
                  key={
                    rack.id
                  }

                  className="map-object"

                  transform={`
                    translate(
                      ${
                        rack.x *
                        SCALE
                      }
                      ${
                        rack.y *
                        SCALE
                      }
                    )

                    rotate(
                      ${
                        rack.rotation
                      }
                    )
                  `}

                  onPointerDown={(
                    event
                  ) =>
                    handleObjectPointerDown(
                      event,
                      "rack",
                      rack
                    )
                  }
                >
                  <rect
                    x={
                      -(
                        rack.width *
                        SCALE
                      ) /
                      2
                    }

                    y={
                      -(
                        rack.depth *
                        SCALE
                      ) /
                      2
                    }

                    width={
                      rack.width *
                      SCALE
                    }

                    height={
                      rack.depth *
                      SCALE
                    }

                    rx="5"

                    className={`map-rack ${
                      selected
                        ? "selected"
                        : ""
                    }`}
                  />

                  <text
                    x="0"
                    y="4"

                    textAnchor="middle"

                    className="map-object-label"
                  >
                    {rack.name}
                  </text>
                </g>
              );
            }
          )}


          {/* STATIONS */}

          {mapData.stations.map(
            (station) => {
              const selected =
                mode === "edit" &&
                selectedObject?.type ===
                  "station" &&
                selectedObject?.id ===
                  station.id;

              return (
                <g
                  key={
                    station.id
                  }

                  className="map-object"

                  transform={`
                    translate(
                      ${
                        station.x *
                        SCALE
                      }
                      ${
                        station.y *
                        SCALE
                      }
                    )

                    rotate(
                      ${
                        station.rotation
                      }
                    )
                  `}

                  onPointerDown={(
                    event
                  ) =>
                    handleObjectPointerDown(
                      event,
                      "station",
                      station
                    )
                  }
                >
                  <rect
                    x={
                      -(
                        station.width *
                        SCALE
                      ) /
                      2
                    }

                    y={
                      -(
                        station.depth *
                        SCALE
                      ) /
                      2
                    }

                    width={
                      station.width *
                      SCALE
                    }

                    height={
                      station.depth *
                      SCALE
                    }

                    rx="6"

                    className={[
                      "map-station",

                      station.type ===
                      "CHARGING"
                        ? "charging"
                        : "dock",

                      selected
                        ? "selected"
                        : "",
                    ].join(" ")}
                  />

                  <text
                    x="0"
                    y="4"

                    textAnchor="middle"

                    className="map-object-label"
                  >
                    {station.name}
                  </text>
                </g>
              );
            }
          )}


          {/* NODES */}

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
                <g
                  key={
                    node.id
                  }

                  className="map-node-group"

                  onPointerDown={(
                    event
                  ) =>
                    handleNodePointerDown(
                      event,
                      node
                    )
                  }
                >
                  <circle
                    cx={
                      node.x *
                      SCALE
                    }

                    cy={
                      node.y *
                      SCALE
                    }

                    r={
                      selected ||
                      connecting
                        ? 10
                        : 8
                    }

                    className={[
                      "map-node-circle",

                      `node-${node.type.toLowerCase()}`,

                      selected
                        ? "selected"
                        : "",

                      connecting
                        ? "connecting"
                        : "",
                    ].join(" ")}
                  />

                  <text
                    x={
                      node.x *
                      SCALE
                    }

                    y={
                      node.y *
                        SCALE -
                      15
                    }

                    textAnchor="middle"

                    className="map-node-label"
                  >
                    {node.id}
                  </text>
                </g>
              );
            }
          )}


          {/* ROBOTS */}

          {mode === "monitor" &&
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
                    ) => {
                      event.stopPropagation();

                      onRobotClick(
                        robot.id
                      );
                    }}
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


      {/* ORIGIN */}

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
      path[index + 1];

    if (
      (
        edge.from ===
          from &&
        edge.to ===
          to
      ) ||
      (
        edge.from ===
          to &&
        edge.to ===
          from
      )
    ) {
      return true;
    }
  }

  return false;
}