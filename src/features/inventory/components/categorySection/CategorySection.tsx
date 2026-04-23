import type { ReactElement } from "react";
import { useState } from "react";
import { Button } from "../../../../components/Button/Button";
import { Badge } from "../../../../components/Badge/Badge";
import type { InventoryProduct } from "../../types";
import { ProductCard } from "../productCard/ProductCard";

interface CategorySectionProps {
  name: string;
  products: InventoryProduct[];
  onEdit: (product: InventoryProduct) => void;
  onAddToList: (product: InventoryProduct) => void;
  onRemove: (id: string) => void;
  onCardClick?: (product: InventoryProduct) => void;
}

export const CategorySection = ({
  name,
  products,
  onEdit,
  onAddToList,
  onRemove,
  onCardClick,
}: CategorySectionProps): ReactElement => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const lowStockCount = products.filter((product) => product.quantity <= product.minStock).length;

  return (
    <section className="space-y-2">
      <Button
        variant="ghost"
        className="w-full justify-between px-3 py-2 rounded-lg bg-base-100 border border-base-300"
        onClick={() => setExpanded((previous) => !previous)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {name}
          <span className="text-xs text-base-content/60">({products.length})</span>
        </span>
        {lowStockCount > 0 && (
          <Badge variant="warning" size="sm">
            {lowStockCount} baixo
          </Badge>
        )}
      </Button>

      {expanded && (
        <div className="space-y-2">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onEdit={onEdit}
              onAddToList={onAddToList}
              onRemove={onRemove}
              onCardClick={onCardClick}
            />
          ))}
        </div>
      )}
    </section>
  );
};
