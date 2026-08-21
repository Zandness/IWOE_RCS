import { useRef } from "react";

export default function MapCanvas({
  mapData,

  tool,

  selectedNodeId,
  selectedObject,

  connectionStart,

  zoom,

  onCanvasClick,

  onNodeClick,
  onNodeMove,

  onNodeDragStart,
  onNodeDragEnd,

  onObjectClick,
}) {
  const svgRef = useRef(null);

  const SCALE = 30;

  const canvasWidth =
    mapData.width * SCALE;

  const canvasHeight =
    mapData.height * SCALE;

  /*
   * Convert mouse position
   * to warehouse coordinate
   */

  function getMousePosition(
    event
  ) {
    const svg =
      svgRef.current;

    if (!svg) {
      return {
        x: 0,
        y: 0,
      };
    }

    const rect =
      svg.getBoundingClientRect();

    const ratioX =
      canvasWidth /
      rect.width;

    const ratioY =
      canvasHeight /
      rect.height;

    const pixelX =
      (event.clientX -
        rect.left) *
      ratioX;

    const pixelY =
      (event.clientY -
        rect.top) *
      ratioY;

    return {
      x: Number(
        (
          pixelX /
          SCALE
        ).toFixed(2)
      ),

      y: Number(
        (
          pixelY /
          SCALE
        ).toFixed(2)
      ),
    };
  }

  /*
   * Background click
   */

  function handleCanvasClick(
    event
  ) {
    /*
     * Don't create object when
     * clicking existing object
     */

    if (
      event.target.closest(
        ".map-object"
      ) ||
      event.target.closest(
        ".map-node-group"
      )
    ) {
      return;
    }

    const position =
      getMousePosition(
        event
      );

    onCanvasClick(
      position
    );
  }

  /*
   * Node dragging
   */

  function handleNodeMouseDown(
    event,
    node
  ) {
    event.stopPropagation();

    /*
     * Connect mode
     */

    if (
      tool !== "select"
    ) {
      onNodeClick(
        node.id
      );

      return;
    }

    onNodeClick(
      node.id
    );

    onNodeDragStart?.(
      node.id
    );

    function handleMove(
      moveEvent
    ) {
      const position =
        getMousePosition(
          moveEvent
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

    function handleUp() {
      window.removeEventListener(
        "mousemove",
        handleMove
      );

      window.removeEventListener(
        "mouseup",
        handleUp
      );

      onNodeDragEnd?.(
        node.id
      );
    }

    window.addEventListener(
      "mousemove",
      handleMove
    );

    window.addEventListener(
      "mouseup",
      handleUp
    );
  }

  return (
    <div className="map-canvas-wrapper">

      <div
        className="map-zoom-layer"
        style={{
          width:
            `${zoom * 100}%`,
        }}
      >
        <svg
          ref={svgRef}

          className={`map-editor-canvas tool-${tool}`}

          viewBox={
            `0 0 ${canvasWidth} ${canvasHeight}`
          }

          onClick={
            handleCanvasClick
          }
        >

          {/* BACKGROUND */}

          <rect
            x="0"
            y="0"

            width={
              canvasWidth
            }

            height={
              canvasHeight
            }

            className="map-background"
          />

          {/* GRID */}

          <Grid
            width={
              canvasWidth
            }

            height={
              canvasHeight
            }

            spacing={
              mapData.gridSpacing *
              SCALE
            }
          />

          {/* RACKS */}

          {mapData.racks.map(
            (rack) => {
              const selected =
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
                      ${rack.x * SCALE}
                      ${rack.y * SCALE}
                    )
                    rotate(
                      ${rack.rotation}
                    )
                  `}

                  onClick={(
                    event
                  ) => {
                    event.stopPropagation();

                    onObjectClick({
                      type:
                        "rack",

                      id:
                        rack.id,
                    });
                  }}
                >
                  <rect
                    x={
                      -(
                        rack.width *
                        SCALE
                      ) / 2
                    }

                    y={
                      -(
                        rack.depth *
                        SCALE
                      ) / 2
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

                    className={
                      `map-rack ${
                        selected
                          ? "selected"
                          : ""
                      }`
                    }
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
                      ${station.x * SCALE}
                      ${station.y * SCALE}
                    )
                    rotate(
                      ${station.rotation}
                    )
                  `}

                  onClick={(
                    event
                  ) => {
                    event.stopPropagation();

                    onObjectClick({
                      type:
                        "station",

                      id:
                        station.id,
                    });
                  }}
                >
                  <rect
                    x={
                      -(
                        station.width *
                        SCALE
                      ) / 2
                    }

                    y={
                      -(
                        station.depth *
                        SCALE
                      ) / 2
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

                    className="map-edge"
                  />

                  <text
                    x={
                      (
                        x1 +
                        x2
                      ) / 2
                    }

                    y={
                      (
                        y1 +
                        y2
                      ) /
                        2 -
                      8
                    }

                    textAnchor="middle"

                    className="edge-distance"
                  >
                    {
                      edge.distance.toFixed(
                        2
                      )
                    }{" "}
                    m
                  </text>
                </g>
              );
            }
          )}

          {/* NODES */}

          {mapData.nodes.map(
            (node) => {
              const selected =
                selectedNodeId ===
                node.id;

              const connecting =
                connectionStart ===
                node.id;

              return (
                <g
                  key={
                    node.id
                  }

                  className="map-node-group"

                  onMouseDown={(
                    event
                  ) =>
                    handleNodeMouseDown(
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

        </svg>
      </div>
    </div>
  );
}


/* =========================
   GRID
========================= */

function Grid({
  width,
  height,
  spacing,
}) {
  if (
    !spacing ||
    spacing <= 0
  ) {
    return null;
  }

  const vertical = [];
  const horizontal = [];

  for (
    let x = 0;
    x <= width;
    x += spacing
  ) {
    vertical.push(
      <line
        key={`v-${x}`}

        x1={x}
        y1="0"

        x2={x}
        y2={height}

        className="grid-line"
      />
    );
  }

  for (
    let y = 0;
    y <= height;
    y += spacing
  ) {
    horizontal.push(
      <line
        key={`h-${y}`}

        x1="0"
        y1={y}

        x2={width}
        y2={y}

        className="grid-line"
      />
    );
  }

  return (
    <g className="grid-layer">
      {vertical}
      {horizontal}
    </g>
  );
}


function snapToGrid(
  position,
  spacing
) {
  if (
    !spacing ||
    spacing <= 0
  ) {
    return position;
  }

  return {
    x:
      Math.round(
        position.x /
        spacing
      ) *
      spacing,

    y:
      Math.round(
        position.y /
        spacing
      ) *
      spacing,
  };
}