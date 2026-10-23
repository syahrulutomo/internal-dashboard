import type {
  HTMLAttributes,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from "react";
import { cn } from "@/libs/cn";
import { SortIcon } from "@/views/ui/Icons";

export function Table({
  className,
  ...props
}: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn(
        "w-full min-w-[720px] border-collapse text-left text-sm",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead {...props} />;
}

export function TableBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function TableRow({
  className,
  ...props
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn("border-b border-[var(--border)] last:border-0", className)}
      {...props}
    />
  );
}

export function TableHeaderCell({
  children,
  align = "left",
  sortable,
  className,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "right";
  sortable?: boolean;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "px-6 py-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]",
        align === "right" ? "text-right" : "text-left",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          align === "right" && "flex-row-reverse",
        )}
      >
        {children}
        {sortable && <SortIcon className="size-3.5 text-gray-300" />}
      </span>
    </th>
  );
}

export function TableCell({
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-6 py-4", className)} {...props} />;
}
