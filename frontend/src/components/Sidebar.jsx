import {
  Bot,
  Boxes,
  CheckCircle2,
  ClipboardList,
  LayoutDashboard,
  Map,
  MapPin,
  Send,
  Settings,
  Warehouse,
} from "lucide-react";

import {
  NavLink,
} from "react-router-dom";


export default function Sidebar() {
  const menu = [
    {
      name:
        "Dashboard",

      path:
        "/",

      icon:
        LayoutDashboard,

      end:
        true,
    },

    {
      name:
        "Warehouse Map",

      path:
        "/warehouse",

      icon:
        Map,
    },

    {
      name:
        "Storage Locations",

      path:
        "/locations",

      icon:
        MapPin,
    },

    {
      name:
        "Inventory / SKU",

      path:
        "/inventory",

      icon:
        Boxes,
    },

    {
      name:
        "Warehouse Operations",

      path:
        "/operations",

      icon:
        ClipboardList,
    },

    {
      name:
        "Task Management",

      path:
        "/tasks",

      icon:
        CheckCircle2,
    },

    {
      name:
        "RCS Dispatch Queue",

      path:
        "/dispatcher",

      icon:
        Send,
    },

    {
      name:
        "Fleet Control",

      path:
        "/fleet",

      icon:
        Bot,
    },

    {
      name:
        "Settings",

      path:
        "/settings",

      icon:
        Settings,
    },
  ];


  return (
    <aside className="sidebar">

      <div className="sidebar-title">

        <Warehouse
          size={20}
        />

        <span>
          WMS
        </span>

      </div>


      <nav>

        {menu.map(
          (item) => {
            const Icon =
              item.icon;


            return (
              <NavLink
                key={
                  item.path
                }

                to={
                  item.path
                }

                end={
                  item.end
                }

                className={({
                  isActive,
                }) =>
                  `sidebar-link ${
                    isActive
                      ? "active"
                      : ""
                  }`
                }
              >

                <Icon
                  size={19}
                />


                <span>
                  {
                    item.name
                  }
                </span>

              </NavLink>
            );
          }
        )}

      </nav>


      <div className="sidebar-footer">

        <div className="status-dot" />


        <div>

          <strong>
            System Ready
          </strong>


          <span>
            WMS Core
          </span>

        </div>

      </div>

    </aside>
  );
}