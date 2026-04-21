import type { ReactElement } from "react";
import { InventoryFeatureApp } from "./features/inventory/InventoryFeatureApp";

const App = (): ReactElement => {
  const component = (
    <>
      <InventoryFeatureApp />
    </>
  );
  return component;
};

export default App;
