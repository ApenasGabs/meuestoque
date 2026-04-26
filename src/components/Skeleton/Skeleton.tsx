import type { HTMLAttributes, ReactElement } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circle" | "rect";
  width?: string;
  height?: string;
  lines?: number;
  className?: string;
}

/**
 * Skeleton component for displaying placeholder loading states.
 * 
 * Supports text lines, circular, and rectangular formats using daisyUI skeleton classes.
 *
 * @param props.variant - Visual shape (text, circle, rect)
 * @param props.width - Custom CSS width
 * @param props.height - Custom CSS height
 * @param props.lines - Number of text lines (only applicable for variant="text")
 * @param props.className - Additional CSS classes
 */
export const Skeleton = ({
  variant = "text",
  width,
  height,
  lines = 1,
  className = "",
  ...props
}: SkeletonProps): ReactElement => {
  const style = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  if (variant === "circle") {
    return (
      <div
        className={`skeleton rounded-full ${className}`.trim()}
        style={{ width: width ?? "3rem", height: height ?? "3rem", ...style }}
        {...props}
      />
    );
  }

  if (variant === "rect") {
    return (
      <div
        className={`skeleton ${className}`.trim()}
        style={{ width: width ?? "100%", height: height ?? "8rem", ...style }}
        {...props}
      />
    );
  }

  // variant === "text"
  if (lines === 1) {
    return (
      <div
        className={`skeleton h-4 ${className}`.trim()}
        style={style}
        {...props}
      />
    );
  }

  return (
    <div className={`space-y-2 ${className}`.trim()} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="skeleton h-4"
          style={index === lines - 1 ? { width: "75%" } : undefined}
        />
      ))}
    </div>
  );
};

interface SkeletonCardProps {
  className?: string;
}

/**
 * Pre-formatted Skeleton variant mimicking a product or item card layout.
 */
export const SkeletonCard = ({
  className = "",
}: SkeletonCardProps): ReactElement => {
  return (
    <div
      className={`rounded-lg border border-base-300 bg-base-100 p-4 space-y-3 ${className}`.trim()}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" width="2.5rem" height="2.5rem" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </div>
      </div>
    </div>
  );
};
