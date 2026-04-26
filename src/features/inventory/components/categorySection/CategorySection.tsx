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
  onConsume: (product: InventoryProduct) => void;
  onOpenCustomConsume: (product: InventoryProduct) => void;
  onCardClick?: (product: InventoryProduct) => void;
  onViewHistory?: (product: InventoryProduct) => void;
}

export const CategorySection = ({
  name,
  products,
  onEdit,
  onAddToList,
  onRemove,
  onConsume,
  onOpenCustomConsume,
  onCardClick,
  onViewHistory,
}: CategorySectionProps): ReactElement => {
  const [expanded, setExpanded] = useState<boolean>(true);
  const lowStockCount = products.filter((product) => product.quantity <= product.minStock).length;
  const autoConsumeCount = products.filter((p) => (p.consumeValue ?? 0) > 0).length;

  return (
    <section className="space-y-2">
      <Button
        variant="ghost"
        className="w-full justify-between px-3 py-2 rounded-lg bg-base-100 border border-base-300"
        onClick={() => setExpanded((previous) => !previous)}
      >
        <span className="flex items-center gap-2 text-sm font-semibold truncate">
          <span className="truncate">{name}</span>
          <span className="text-xs text-base-content/60 flex-shrink-0">({products.length})</span>
        </span>
        <span className="flex items-center gap-1">
          {autoConsumeCount > 0 && (
            <Badge variant="info" size="sm">
              🤖 {autoConsumeCount}
            </Badge>
          )}
          {lowStockCount > 0 && (
            <Badge variant="warning" size="sm">
              {lowStockCount} baixo
            </Badge>
          )}
        </span>
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
              onConsume={onConsume}
              onOpenCustomConsume={onOpenCustomConsume}
              onCardClick={onCardClick}
              onViewHistory={onViewHistory}
            />
          ))}
        </div>
      )}
    </section>
  );
};
