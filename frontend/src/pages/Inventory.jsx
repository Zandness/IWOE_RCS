import {
  AlertTriangle,
  Boxes,
  CircleDollarSign,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Warehouse,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import "../styles/Inventory.css";


const INVENTORY_STORAGE_KEY =
  "wms-inventory-items-v1";

const LOCATION_STORAGE_KEY =
  "wms-storage-locations-v1";


const INITIAL_INVENTORY = [
  {
    id: "INV-001",

    sku: "SKU-001",

    name:
      "Plastic Bin 600x400",

    category:
      "Container",

    unit:
      "PCS",

    quantity:
      48,

    minStock:
      20,

    maxStock:
      100,

    locationId:
      "LOC-001",
  },

  {
    id: "INV-002",

    sku: "SKU-002",

    name:
      "Carton Box M",

    category:
      "Packaging",

    unit:
      "PCS",

    quantity:
      12,

    minStock:
      15,

    maxStock:
      80,

    locationId:
      "LOC-002",
  },

  {
    id: "INV-003",

    sku: "SKU-003",

    name:
      "Pallet 1100x1100",

    category:
      "Pallet",

    unit:
      "PCS",

    quantity:
      0,

    minStock:
      5,

    maxStock:
      30,

    locationId:
      "LOC-003",
  },
];


export default function Inventory() {

  /*
   * =====================================================
   * INVENTORY STATE
   * =====================================================
   */

  const [
    items,
    setItems,
  ] = useState(
    loadInventory
  );


  /*
   * =====================================================
   * STORAGE LOCATIONS
   * =====================================================
   */

  const [
    locations,
    setLocations,
  ] = useState(
    loadLocations
  );


  /*
   * =====================================================
   * UI STATE
   * =====================================================
   */

  const [
    search,
    setSearch,
  ] = useState("");


  const [
    statusFilter,
    setStatusFilter,
  ] = useState(
    "ALL"
  );


  const [
    showForm,
    setShowForm,
  ] = useState(false);


  const [
    selectedItem,
    setSelectedItem,
  ] = useState(null);


  const [
    saveMessage,
    setSaveMessage,
  ] = useState("");


  /*
   * =====================================================
   * SAVE INVENTORY
   * =====================================================
   */

  useEffect(() => {
    try {
      localStorage.setItem(
        INVENTORY_STORAGE_KEY,

        JSON.stringify(
          items
        )
      );

      setSaveMessage(
        "Saved locally"
      );
    } catch (error) {
      console.error(
        "Could not save inventory.",
        error
      );

      setSaveMessage(
        "Local save failed"
      );
    }
  }, [items]);


  /*
   * =====================================================
   * REFRESH STORAGE LOCATIONS
   * =====================================================
   */

  useEffect(() => {

    function refreshLocations() {
      setLocations(
        loadLocations()
      );
    }


    function handleStorage(
      event
    ) {
      if (
        event.key ===
        LOCATION_STORAGE_KEY
      ) {
        refreshLocations();
      }


      if (
        event.key ===
          INVENTORY_STORAGE_KEY &&
        event.newValue
      ) {
        setItems(
          loadInventory()
        );
      }
    }


    window.addEventListener(
      "focus",
      refreshLocations
    );


    window.addEventListener(
      "storage",
      handleStorage
    );


    return () => {

      window.removeEventListener(
        "focus",
        refreshLocations
      );


      window.removeEventListener(
        "storage",
        handleStorage
      );

    };

  }, []);


  /*
   * =====================================================
   * LOCATION LOOKUP
   * =====================================================
   */

  const locationMap =
    useMemo(() => {

      return new Map(
        locations.map(
          (location) => [
            location.id,
            location,
          ]
        )
      );

    }, [locations]);


  /*
   * =====================================================
   * SEARCH + FILTER
   * =====================================================
   */

  const filteredItems =
    useMemo(() => {

      const query =
        search
          .trim()
          .toLowerCase();


      return items.filter(
        (item) => {

          const status =
            getStockStatus(
              item
            );


          const location =
            locationMap.get(
              item.locationId
            );


          const matchesStatus =
            statusFilter ===
              "ALL" ||
            status ===
              statusFilter;


          const matchesSearch =
            !query ||
            [
              item.id,
              item.sku,
              item.name,
              item.category,
              item.unit,

              item.locationId,

              location?.code,
              location?.zone,
              location?.rack,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(query);


          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );

    }, [
      items,
      locationMap,
      search,
      statusFilter,
    ]);


  /*
   * =====================================================
   * SUMMARY
   * =====================================================
   */

  const summary =
    useMemo(() => {

      const uniqueSkus =
        new Set(
          items.map(
            (item) =>
              item.sku
          )
        ).size;


      const totalQuantity =
        items.reduce(
          (
            sum,
            item
          ) =>
            sum +
            Number(
              item.quantity ||
                0
            ),

          0
        );


      const lowStock =
        items.filter(
          (item) =>
            getStockStatus(
              item
            ) ===
            "LOW_STOCK"
        ).length;


      const outOfStock =
        items.filter(
          (item) =>
            getStockStatus(
              item
            ) ===
            "OUT_OF_STOCK"
        ).length;


      const linkedLocations =
        new Set(
          items
            .map(
              (item) =>
                item.locationId
            )
            .filter(Boolean)
        ).size;


      return {
        uniqueSkus,

        totalQuantity,

        lowStock,

        outOfStock,

        linkedLocations,
      };

    }, [items]);


  /*
   * =====================================================
   * ADD
   * =====================================================
   */

  function handleAdd() {

    setSelectedItem(
      null
    );

    setShowForm(
      true
    );

  }


  /*
   * =====================================================
   * EDIT
   * =====================================================
   */

  function handleEdit(
    item
  ) {

    setSelectedItem(
      item
    );

    setShowForm(
      true
    );

  }


  /*
   * =====================================================
   * DELETE
   * =====================================================
   */

  function handleDelete(
    id
  ) {

    const target =
      items.find(
        (item) =>
          item.id === id
      );


    const confirmed =
      window.confirm(
        `Delete inventory record ${
          target?.sku ||
          id
        }?`
      );


    if (!confirmed) {
      return;
    }


    setItems(
      (current) =>
        current.filter(
          (item) =>
            item.id !==
            id
        )
    );


    if (
      selectedItem?.id ===
      id
    ) {

      setSelectedItem(
        null
      );

      setShowForm(
        false
      );

    }

  }


  /*
   * =====================================================
   * SAVE FORM
   * =====================================================
   */

  function handleSave(
    formData
  ) {

    const validation =
      validateInventoryItem({
        formData,

        editingId:
          selectedItem?.id ||
          null,

        items,

        locations,
      });


    if (
      !validation.ok
    ) {
      return validation;
    }


    /*
     * EDIT
     */

    if (
      selectedItem
    ) {

      setItems(
        (current) =>
          current.map(
            (item) =>
              item.id ===
              selectedItem.id
                ? {
                    ...item,

                    ...validation.item,
                  }
                : item
          )
      );

    }

    /*
     * CREATE
     */

    else {

      setItems(
        (current) => [
          ...current,

          {
            id:
              getNextInventoryId(
                current
              ),

            ...validation.item,
          },
        ]
      );

    }


    setShowForm(
      false
    );


    setSelectedItem(
      null
    );


    return {
      ok: true,
    };

  }


  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <div className="inventory-page">

      {/* =================================================
          HEADER
      ================================================= */}

      <div className="inventory-header">

        <div>

          <span className="inventory-label">
            WAREHOUSE MANAGEMENT
          </span>


          <h2>
            Inventory / SKU
          </h2>


          <p>
            Manage SKU stock,
            reorder levels and
            storage location
            assignment.
          </p>

        </div>


        <div className="inventory-header-actions">

          {saveMessage && (

            <span
              className={`inventory-save-state ${
                saveMessage.includes(
                  "failed"
                )
                  ? "error"
                  : ""
              }`}
            >
              {saveMessage}
            </span>

          )}


          <button
            className="inventory-add-button"
            onClick={
              handleAdd
            }
          >

            <Plus
              size={18}
            />

            Add SKU

          </button>

        </div>

      </div>


      {/* =================================================
          SUMMARY
      ================================================= */}

      <div className="inventory-summary-grid">

        <SummaryCard
          icon={
            <Package
              size={21}
            />
          }

          title="Unique SKUs"

          value={
            summary.uniqueSkus
          }
        />


        <SummaryCard
          icon={
            <Boxes
              size={21}
            />
          }

          title="Total Quantity"

          value={
            summary.totalQuantity
          }
        />


        <SummaryCard
          icon={
            <AlertTriangle
              size={21}
            />
          }

          title="Low Stock"

          value={
            summary.lowStock
          }

          tone="warning"
        />


        <SummaryCard
          icon={
            <CircleDollarSign
              size={21}
            />
          }

          title="Out of Stock"

          value={
            summary.outOfStock
          }

          tone="danger"
        />


        <SummaryCard
          icon={
            <MapPin
              size={21}
            />
          }

          title="Used Locations"

          value={
            summary.linkedLocations
          }
        />

      </div>


      {/* =================================================
          INVENTORY PANEL
      ================================================= */}

      <section className="inventory-panel">

        <div className="inventory-panel-header">

          <div>

            <h3>
              Inventory Directory
            </h3>


            <p>
              Each record links a
              SKU stock balance to
              one storage location.
            </p>

          </div>


          <div className="inventory-toolbar">

            <div className="inventory-search">

              <Search
                size={17}
              />


              <input
                type="text"

                placeholder="Search SKU, item or location..."

                value={
                  search
                }

                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
              />

            </div>


            <select
              className="inventory-filter"

              value={
                statusFilter
              }

              onChange={(
                event
              ) =>
                setStatusFilter(
                  event.target
                    .value
                )
              }
            >

              <option value="ALL">
                All status
              </option>

              <option value="IN_STOCK">
                In Stock
              </option>

              <option value="LOW_STOCK">
                Low Stock
              </option>

              <option value="OUT_OF_STOCK">
                Out of Stock
              </option>

            </select>

          </div>

        </div>


        {/* =================================================
            TABLE
        ================================================= */}

        <div className="inventory-table-wrapper">

          <table className="inventory-table">

            <thead>

              <tr>

                <th>
                  SKU
                </th>

                <th>
                  Item
                </th>

                <th>
                  Category
                </th>

                <th>
                  Location
                </th>

                <th>
                  Quantity
                </th>

                <th>
                  Stock Level
                </th>

                <th>
                  Unit
                </th>

                <th>
                  Status
                </th>

                <th></th>

              </tr>

            </thead>


            <tbody>

              {filteredItems.map(
                (item) => {

                  const location =
                    locationMap.get(
                      item.locationId
                    );


                  const status =
                    getStockStatus(
                      item
                    );


                  const percentage =
                    getStockPercentage(
                      item
                    );


                  return (
                    <tr
                      key={
                        item.id
                      }
                    >

                      {/* SKU */}

                      <td>

                        <div className="inventory-sku-cell">

                          <div className="inventory-icon">

                            <Package
                              size={
                                17
                              }
                            />

                          </div>


                          <div>

                            <strong>
                              {
                                item.sku
                              }
                            </strong>


                            <span>
                              {
                                item.id
                              }
                            </span>

                          </div>

                        </div>

                      </td>


                      {/* ITEM */}

                      <td>

                        <div className="inventory-item-name">

                          <strong>
                            {
                              item.name
                            }
                          </strong>

                        </div>

                      </td>


                      {/* CATEGORY */}

                      <td>
                        {
                          item.category
                        }
                      </td>


                      {/* LOCATION */}

                      <td>

                        <LocationBadge
                          locationId={
                            item.locationId
                          }

                          location={
                            location
                          }
                        />

                      </td>


                      {/* QUANTITY */}

                      <td>

                        <strong className="inventory-quantity">
                          {
                            item.quantity
                          }
                        </strong>

                      </td>


                      {/* STOCK LEVEL */}

                      <td>

                        <div className="inventory-level-cell">

                          <div>

                            <span>
                              Min
                              {" "}
                              {
                                item.minStock
                              }
                            </span>


                            <span>
                              Max
                              {" "}
                              {
                                item.maxStock
                              }
                            </span>

                          </div>


                          <div className="inventory-level-track">

                            <div
                              className={`inventory-level-fill ${status.toLowerCase()}`}

                              style={{
                                width:
                                  `${percentage}%`,
                              }}
                            />

                          </div>

                        </div>

                      </td>


                      {/* UNIT */}

                      <td>
                        {
                          item.unit
                        }
                      </td>


                      {/* STATUS */}

                      <td>

                        <span
                          className={`inventory-status status-${status.toLowerCase()}`}
                        >
                          {
                            formatStatus(
                              status
                            )
                          }
                        </span>

                      </td>


                      {/* ACTIONS */}

                      <td>

                        <div className="inventory-actions">

                          <button
                            type="button"

                            title="Edit"

                            onClick={() =>
                              handleEdit(
                                item
                              )
                            }
                          >

                            <Pencil
                              size={
                                16
                              }
                            />

                          </button>


                          <button
                            type="button"

                            title="Delete"

                            onClick={() =>
                              handleDelete(
                                item.id
                              )
                            }
                          >

                            <Trash2
                              size={
                                16
                              }
                            />

                          </button>

                        </div>

                      </td>

                    </tr>
                  );
                }
              )}

            </tbody>

          </table>


          {filteredItems.length ===
            0 && (

            <div className="inventory-empty">
              No inventory records
              found.
            </div>

          )}

        </div>

      </section>


      {/* =================================================
          FORM MODAL
      ================================================= */}

      {showForm && (

        <InventoryForm
          item={
            selectedItem
          }

          items={
            items
          }

          locations={
            locations
          }

          onSave={
            handleSave
          }

          onCancel={() => {

            setShowForm(
              false
            );

            setSelectedItem(
              null
            );

          }}
        />

      )}

    </div>
  );
}


/*
 * =====================================================
 * SUMMARY CARD
 * =====================================================
 */

function SummaryCard({
  icon,
  title,
  value,
  tone = "default",
}) {

  return (
    <div
      className={`inventory-summary-card tone-${tone}`}
    >

      <div className="inventory-summary-icon">
        {icon}
      </div>


      <div>

        <span>
          {title}
        </span>


        <strong>
          {value}
        </strong>

      </div>

    </div>
  );
}


/*
 * =====================================================
 * LOCATION BADGE
 * =====================================================
 */

function LocationBadge({
  locationId,
  location,
}) {

  /*
   * INVALID / DELETED LOCATION
   */

  if (!location) {

    return (
      <div className="inventory-location-wrap">

        <span className="inventory-location invalid">

          <AlertTriangle
            size={13}
          />

          {locationId ||
            "No location"}

        </span>


        <small>
          Missing storage
          location
        </small>

      </div>
    );

  }


  /*
   * VALID LOCATION
   */

  return (
    <div className="inventory-location-wrap">

      <span className="inventory-location">

        <MapPin
          size={13}
        />

        {
          location.code
        }

      </span>


      <small>

        {
          location.zone
        }

        {" · "}

        {
          location.rack
        }

        {" · L"}

        {
          location.level
        }

      </small>

    </div>
  );
}


/*
 * =====================================================
 * INVENTORY FORM
 * =====================================================
 */

function InventoryForm({
  item,
  items,
  locations,
  onSave,
  onCancel,
}) {

  const [
    form,
    setForm,
  ] = useState({

    sku:
      item?.sku ||
      "",

    name:
      item?.name ||
      "",

    category:
      item?.category ||
      "",

    unit:
      item?.unit ||
      "PCS",

    quantity:
      item?.quantity ??
      0,

    minStock:
      item?.minStock ??
      0,

    maxStock:
      item?.maxStock ??
      100,

    locationId:
      item?.locationId ||
      "",

  });


  const [
    error,
    setError,
  ] = useState("");


  /*
   * =====================================================
   * AVAILABLE STORAGE LOCATIONS
   * =====================================================
   *
   * New inventory:
   *   AVAILABLE locations only
   *
   * Existing inventory:
   *   current location remains selectable
   *
   * FULL / BLOCKED / MAINTENANCE
   * are not offered for a new assignment.
   */

  const selectableLocations =
    useMemo(() => {

      return locations
        .filter(
          (location) => {

            /*
             * Keep existing location
             */

            if (
              location.id ===
              item?.locationId
            ) {
              return true;
            }


            return ![
              "FULL",
              "BLOCKED",
              "MAINTENANCE",
            ].includes(
              location.status
            );

          }
        )
        .sort(
          (a, b) =>
            String(
              a.code
            ).localeCompare(
              String(
                b.code
              )
            )
        );

    }, [
      item?.locationId,
      locations,
    ]);


  /*
   * =====================================================
   * CHANGE FIELD
   * =====================================================
   */

  function updateField(
    field,
    value
  ) {

    setForm(
      (current) => ({
        ...current,

        [field]:
          value,
      })
    );


    if (error) {
      setError("");
    }

  }


  /*
   * =====================================================
   * SUBMIT
   * =====================================================
   */

  function handleSubmit(
    event
  ) {

    event.preventDefault();


    const result =
      onSave(
        form
      );


    if (
      !result?.ok
    ) {

      setError(
        result?.message ||
          "Could not save inventory item."
      );

    }

  }


  /*
   * =====================================================
   * SELECTED LOCATION
   * =====================================================
   */

  const selectedLocation =
    locations.find(
      (location) =>
        location.id ===
        form.locationId
    );


  /*
   * =====================================================
   * STOCK PREVIEW
   * =====================================================
   */

  const previewItem = {

    quantity:
      Number(
        form.quantity
      ) || 0,

    minStock:
      Number(
        form.minStock
      ) || 0,

    maxStock:
      Number(
        form.maxStock
      ) || 0,

  };


  const previewStatus =
    getStockStatus(
      previewItem
    );


  /*
   * =====================================================
   * UI
   * =====================================================
   */

  return (
    <div
      className="inventory-modal-backdrop"

      onMouseDown={(
        event
      ) => {

        if (
          event.target ===
          event.currentTarget
        ) {
          onCancel();
        }

      }}
    >

      <form
        className="inventory-modal"

        onSubmit={
          handleSubmit
        }
      >

        {/* =================================================
            HEADER
        ================================================= */}

        <div className="inventory-modal-header">

          <div>

            <span>
              INVENTORY MANAGEMENT
            </span>


            <h3>
              {item
                ? "Edit SKU Stock"
                : "Add SKU Stock"}
            </h3>

          </div>


          <button
            type="button"

            className="inventory-close"

            onClick={
              onCancel
            }

            aria-label="Close"
          >
            ×
          </button>

        </div>


        {/* =================================================
            FORM
        ================================================= */}

        <div className="inventory-form-grid">

          {/* SKU */}

          <FormField
            label="SKU Code"

            value={
              form.sku
            }

            placeholder="SKU-001"

            onChange={(
              value
            ) =>
              updateField(
                "sku",
                value
              )
            }
          />


          {/* ITEM NAME */}

          <FormField
            label="Item Name"

            value={
              form.name
            }

            placeholder="Item name"

            onChange={(
              value
            ) =>
              updateField(
                "name",
                value
              )
            }
          />


          {/* CATEGORY */}

          <FormField
            label="Category"

            value={
              form.category
            }

            placeholder="Packaging"

            onChange={(
              value
            ) =>
              updateField(
                "category",
                value
              )
            }
          />


          {/* UNIT */}

          <FormField
            label="Unit"

            value={
              form.unit
            }

            placeholder="PCS"

            onChange={(
              value
            ) =>
              updateField(
                "unit",
                value
              )
            }
          />


          {/* QUANTITY */}

          <FormField
            label="Quantity"

            type="number"

            min="0"

            value={
              form.quantity
            }

            onChange={(
              value
            ) =>
              updateField(
                "quantity",
                value
              )
            }
          />


          {/* MIN STOCK */}

          <FormField
            label="Minimum Stock"

            type="number"

            min="0"

            value={
              form.minStock
            }

            onChange={(
              value
            ) =>
              updateField(
                "minStock",
                value
              )
            }
          />


          {/* MAX STOCK */}

          <FormField
            label="Maximum Stock"

            type="number"

            min="1"

            value={
              form.maxStock
            }

            onChange={(
              value
            ) =>
              updateField(
                "maxStock",
                value
              )
            }
          />


          {/* LOCATION */}

          <label className="inventory-field">

            <span>
              Storage Location
            </span>


            <select
              value={
                form.locationId
              }

              onChange={(
                event
              ) =>
                updateField(
                  "locationId",
                  event.target
                    .value
                )
              }
            >

              <option value="">
                Select location
              </option>


              {selectableLocations.map(
                (location) => (

                  <option
                    key={
                      location.id
                    }

                    value={
                      location.id
                    }
                  >

                    {
                      location.code
                    }

                    {" - "}

                    {
                      location.zone
                    }

                    {" / "}

                    {
                      location.rack
                    }

                    {" / L"}

                    {
                      location.level
                    }

                    {location.status !==
                      "AVAILABLE"
                      ? ` (${location.status})`
                      : ""}

                  </option>

                )
              )}

            </select>


            <small className="inventory-field-help">

              New stock can be
              assigned only to
              available storage
              locations.

            </small>

          </label>


          {/* =================================================
              PREVIEW
          ================================================= */}

          <div className="inventory-form-preview inventory-form-full">

            <div>

              <Warehouse
                size={17}
              />

              <span>
                Stock Preview
              </span>

            </div>


            <strong>
              {
                formatStatus(
                  previewStatus
                )
              }
            </strong>


            <small>

              {selectedLocation
                ? `${
                    selectedLocation.code
                  } · ${
                    selectedLocation.zone
                  } · ${
                    selectedLocation.rack
                  }`
                : "No storage location selected"}

            </small>

          </div>


          {/* =================================================
              ERROR
          ================================================= */}

          {error && (

            <div className="inventory-form-error inventory-form-full">

              <AlertTriangle
                size={16}
              />


              <span>
                {error}
              </span>

            </div>

          )}

        </div>


        {/* =================================================
            ACTIONS
        ================================================= */}

        <div className="inventory-modal-actions">

          <button
            type="button"

            className="inventory-cancel"

            onClick={
              onCancel
            }
          >
            Cancel
          </button>


          <button
            type="submit"

            className="inventory-save"
          >

            {item
              ? "Save Changes"
              : "Create SKU"}

          </button>

        </div>

      </form>

    </div>
  );
}


/*
 * =====================================================
 * FORM FIELD
 * =====================================================
 */

function FormField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  min,
}) {

  return (
    <label className="inventory-field">

      <span>
        {label}
      </span>


      <input
        type={
          type
        }

        min={
          min
        }

        value={
          value
        }

        placeholder={
          placeholder
        }

        onChange={(
          event
        ) =>
          onChange(
            event.target
              .value
          )
        }
      />

    </label>
  );
}


/*
 * =====================================================
 * VALIDATE INVENTORY
 * =====================================================
 */

function validateInventoryItem({
  formData,
  editingId,
  items,
  locations,
}) {

  /*
   * NORMALIZE TEXT
   */

  const sku =
    String(
      formData.sku ||
        ""
    )
      .trim()
      .toUpperCase();


  const name =
    String(
      formData.name ||
        ""
    ).trim();


  const category =
    String(
      formData.category ||
        ""
    ).trim();


  const unit =
    String(
      formData.unit ||
        ""
    )
      .trim()
      .toUpperCase();


  const locationId =
    String(
      formData.locationId ||
        ""
    ).trim();


  /*
   * NORMALIZE NUMBERS
   */

  const quantity =
    Number(
      formData.quantity
    );


  const minStock =
    Number(
      formData.minStock
    );


  const maxStock =
    Number(
      formData.maxStock
    );


  /*
   * REQUIRED
   */

  if (
    !sku ||
    !name ||
    !category ||
    !unit ||
    !locationId
  ) {

    return {
      ok: false,

      message:
        "Please enter SKU Code, Item Name, Category, Unit and Storage Location.",
    };

  }


  /*
   * QUANTITY
   */

  if (
    !Number.isFinite(
      quantity
    ) ||
    quantity < 0
  ) {

    return {
      ok: false,

      message:
        "Quantity must be 0 or greater.",
    };

  }


  /*
   * MIN STOCK
   */

  if (
    !Number.isFinite(
      minStock
    ) ||
    minStock < 0
  ) {

    return {
      ok: false,

      message:
        "Minimum Stock must be 0 or greater.",
    };

  }


  /*
   * MAX STOCK
   */

  if (
    !Number.isFinite(
      maxStock
    ) ||
    maxStock <= 0
  ) {

    return {
      ok: false,

      message:
        "Maximum Stock must be greater than 0.",
    };

  }


  /*
   * MIN <= MAX
   */

  if (
    minStock >
    maxStock
  ) {

    return {
      ok: false,

      message:
        "Minimum Stock cannot be greater than Maximum Stock.",
    };

  }


  /*
   * =====================================================
   * LOCATION VALIDATION
   * =====================================================
   */

  const location =
    locations.find(
      (candidate) =>
        candidate.id ===
        locationId
    );


  if (!location) {

    return {
      ok: false,

      message:
        "The selected Storage Location does not exist.",
    };

  }


  /*
   * =====================================================
   * DUPLICATE SKU + LOCATION
   * =====================================================
   *
   * Same SKU can exist in
   * multiple locations.
   *
   * But:
   *
   * SKU-001 + LOC-001
   *
   * cannot exist twice.
   */

  const duplicate =
    items.find(
      (item) =>
        item.id !==
          editingId &&

        item.sku ===
          sku &&

        item.locationId ===
          locationId
    );


  if (duplicate) {

    return {
      ok: false,

      message:
        `${sku} already has an inventory record at ${location.code}.`,
    };

  }


  /*
   * =====================================================
   * SAME SKU MASTER DATA
   * =====================================================
   *
   * Same SKU in another
   * location must use the
   * same:
   *
   * name
   * category
   * unit
   */

  const sameSku =
    items.find(
      (item) =>
        item.id !==
          editingId &&
        item.sku ===
          sku
    );


  if (
    sameSku &&

    (
      sameSku.name
        .trim()
        .toLowerCase() !==
        name.toLowerCase() ||

      sameSku.category
        .trim()
        .toLowerCase() !==
        category.toLowerCase() ||

      sameSku.unit !==
        unit
    )
  ) {

    return {
      ok: false,

      message:
        "This SKU already exists with different Item Name, Category or Unit values.",
    };

  }


  /*
   * =====================================================
   * VALID
   * =====================================================
   */

  return {

    ok: true,


    item: {

      sku,

      name,

      category,

      unit,

      quantity,

      minStock,

      maxStock,

      locationId,

    },

  };

}


/*
 * =====================================================
 * STOCK STATUS
 * =====================================================
 */

function getStockStatus(
  item
) {

  const quantity =
    Number(
      item.quantity ||
        0
    );


  const minStock =
    Number(
      item.minStock ||
        0
    );


  /*
   * OUT
   */

  if (
    quantity <= 0
  ) {
    return "OUT_OF_STOCK";
  }


  /*
   * LOW
   */

  if (
    quantity <=
    minStock
  ) {
    return "LOW_STOCK";
  }


  /*
   * NORMAL
   */

  return "IN_STOCK";
}


/*
 * =====================================================
 * STOCK PERCENTAGE
 * =====================================================
 */

function getStockPercentage(
  item
) {

  const quantity =
    Math.max(
      Number(
        item.quantity ||
          0
      ),
      0
    );


  const maxStock =
    Number(
      item.maxStock ||
        0
    );


  if (
    !Number.isFinite(
      maxStock
    ) ||
    maxStock <= 0
  ) {
    return 0;
  }


  return Math.min(
    100,

    Math.round(
      (
        quantity /
        maxStock
      ) *
        100
    )
  );

}


/*
 * =====================================================
 * FORMAT STATUS
 * =====================================================
 */

function formatStatus(
  status
) {

  switch (status) {

    case "LOW_STOCK":
      return "Low Stock";


    case "OUT_OF_STOCK":
      return "Out of Stock";


    default:
      return "In Stock";

  }

}


/*
 * =====================================================
 * NEXT INVENTORY ID
 * =====================================================
 */

function getNextInventoryId(
  items
) {

  let highest = 0;


  for (
    const item
    of items
  ) {

    const match =
      /^INV-(\d+)$/i.exec(
        String(
          item.id ||
            ""
        )
      );


    if (!match) {
      continue;
    }


    highest =
      Math.max(
        highest,

        Number(
          match[1]
        )
      );

  }


  return `INV-${String(
    highest + 1
  ).padStart(
    3,
    "0"
  )}`;

}


/*
 * =====================================================
 * LOAD INVENTORY
 * =====================================================
 */

function loadInventory() {

  try {

    const saved =
      localStorage.getItem(
        INVENTORY_STORAGE_KEY
      );


    if (saved) {

      const parsed =
        JSON.parse(
          saved
        );


      if (
        Array.isArray(
          parsed
        )
      ) {

        return parsed.map(
          normalizeInventoryItem
        );

      }

    }

  } catch (error) {

    console.warn(
      "Could not load saved inventory.",
      error
    );

  }


  return INITIAL_INVENTORY.map(
    normalizeInventoryItem
  );

}


/*
 * =====================================================
 * NORMALIZE INVENTORY
 * =====================================================
 */

function normalizeInventoryItem(
  item,
  index = 0
) {

  return {

    id:
      String(
        item.id ||
          `INV-${String(
            index + 1
          ).padStart(
            3,
            "0"
          )}`
      ),


    sku:
      String(
        item.sku ||
          ""
      )
        .trim()
        .toUpperCase(),


    name:
      String(
        item.name ||
          ""
      ).trim(),


    category:
      String(
        item.category ||
          ""
      ).trim(),


    unit:
      String(
        item.unit ||
          "PCS"
      )
        .trim()
        .toUpperCase(),


    quantity:
      Math.max(
        Number(
          item.quantity
        ) || 0,

        0
      ),


    minStock:
      Math.max(
        Number(
          item.minStock
        ) || 0,

        0
      ),


    maxStock:
      Math.max(
        Number(
          item.maxStock
        ) || 1,

        1
      ),


    locationId:
      String(
        item.locationId ||
          ""
      ).trim(),

  };

}


/*
 * =====================================================
 * LOAD STORAGE LOCATIONS V2
 * =====================================================
 */

function loadLocations() {

  try {

    const saved =
      localStorage.getItem(
        LOCATION_STORAGE_KEY
      );


    if (saved) {

      const parsed =
        JSON.parse(
          saved
        );


      if (
        Array.isArray(
          parsed
        )
      ) {

        return parsed;

      }

    }

  } catch (error) {

    console.warn(
      "Could not load Storage Locations.",
      error
    );

  }


  return [];

}