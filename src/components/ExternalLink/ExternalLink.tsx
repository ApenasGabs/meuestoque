import type { AnchorHTMLAttributes, ReactElement, ReactNode } from "react";

interface ExternalLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  children: ReactNode;
}

/**
 * Secure external link component.
 * 
 * Automatically adds rel="noreferrer" and target="_blank" for safety and accessibility.
 *
 * @param props.href - Destination URL
 * @param props.children - Link text or content
 * @param props.className - Additional CSS classes
 */
export const ExternalLink = ({
  href,
  children,
  className = "",
  ...props
}: ExternalLinkProps): ReactElement => {
  const defaultClasses =
    className ||
    "text-primary hover:text-primary-focus underline transition-colors cursor-pointer";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={defaultClasses}
      {...props}
    >
      {children}
    </a>
  );
};
