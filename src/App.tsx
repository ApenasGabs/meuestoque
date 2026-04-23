import type { ReactElement } from "react";
import { ComprasWebShell } from "./ComprasWebShell";
import { InventoryFeatureApp } from "./features/inventory/InventoryFeatureApp";

const App = (): ReactElement => {
  const newUI = true;
  const component = newUI ? <ComprasWebShell /> : <InventoryFeatureApp />;

  return component;
};

export default App;
