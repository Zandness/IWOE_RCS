export function getLoadInfo(type = "BASKET") {
  const types = {
    BASKET: {
      type: "BASKET",
      label: "Basket",
      plural: "Baskets",
      location: "Shelf",
      description: "Products stored inside this basket.",
    },
    PALLET: {
      type: "PALLET",
      label: "Pallet",
      plural: "Pallets",
      location: "Storage position",
      description: "Products placed on this pallet.",
    },
    RACK: {
      type: "RACK",
      label: "Rack",
      plural: "Racks",
      location: "Rack position",
      description: "Products carried by this rack.",
    },
  };

  return types[type] || types.BASKET;
}

export default function LoadTypeVisual({ type = "BASKET" }) {
  const info = getLoadInfo(type);

  return (
    <svg
      className="load-type-visual"
      viewBox="0 0 160 120"
      role="img"
      aria-label={`${info.label} illustration`}
    >
      {info.type === "BASKET" && (
        <g stroke="#38bdf8" strokeWidth="4" strokeLinejoin="round">
          <path
            d="M30 37H130L119 101H41Z"
            fill="#123851"
          />
          <path d="M25 37H135" />
          <path d="M55 37V23H105V37" fill="none" />
          <path
            d="M53 52L58 87M80 52V87M107 52L102 87"
            fill="none"
          />
        </g>
      )}

      {info.type === "PALLET" && (
        <g strokeLinejoin="round">
          <g fill="#dba35b" stroke="#f6cc88" strokeWidth="2">
            <rect x="29" y="48" width="47" height="39" rx="3" />
            <rect x="82" y="48" width="47" height="39" rx="3" />
            <rect x="55" y="13" width="47" height="30" rx="3" />
          </g>

          <g stroke="#93612f" strokeWidth="4">
            <path d="M52 49V66M106 49V66M79 14V28" />
          </g>

          <g fill="#a87540" stroke="#e9ba78" strokeWidth="2">
            <rect x="19" y="91" width="122" height="8" rx="2" />
            <rect x="25" y="99" width="18" height="13" />
            <rect x="71" y="99" width="18" height="13" />
            <rect x="117" y="99" width="18" height="13" />
          </g>
        </g>
      )}

      {info.type === "RACK" && (
        <g strokeLinejoin="round">
          <path
            d="M35 106V16H125V106"
            fill="#102b40"
            stroke="#38bdf8"
            strokeWidth="6"
          />

          <g stroke="#fbbf24" strokeWidth="5">
            <path d="M35 49H125M35 81H125M29 106H131" />
          </g>

          <g fill="#587d97" stroke="#a6cbe0" strokeWidth="2">
            <rect x="45" y="24" width="29" height="21" rx="2" />
            <rect x="83" y="24" width="29" height="21" rx="2" />
            <rect x="45" y="56" width="67" height="21" rx="2" />
          </g>
        </g>
      )}
    </svg>
  );
}