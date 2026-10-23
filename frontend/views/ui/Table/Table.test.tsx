import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "./index";

describe("Table", () => {
  it("renders a composed table with headers and cells", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Payment ID</TableHeaderCell>
            <TableHeaderCell align="right">Amount</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          <TableRow>
            <TableCell>PAY-0001</TableCell>
            <TableCell>Rp 100</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /payment id/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "PAY-0001" })).toBeInTheDocument();
  });

  it("marks header cells with scope=col", () => {
    render(
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableRow>
        </TableHead>
      </Table>,
    );
    expect(screen.getByRole("columnheader")).toHaveAttribute("scope", "col");
  });
});
