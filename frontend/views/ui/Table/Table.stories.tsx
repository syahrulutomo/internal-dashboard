import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "./index";
import { StatusBadge } from "@/views/presentation/StatusBadge";
import { formatCurrency } from "@/libs/format";
import { samplePayments } from "@/views/_stories/fixtures";

const meta = {
  title: "UI/Table",
  component: Table,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

// The composable table primitives (Head/Body/Row/HeaderCell/Cell), assembled
// into a payments table. HeaderCell supports `align="right"`.
export const Default: Story = {
  render: () => (
    <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-white">
      <Table>
        <TableHead>
          <TableRow>
            <TableHeaderCell>Payment ID</TableHeaderCell>
            <TableHeaderCell>Merchant</TableHeaderCell>
            <TableHeaderCell align="right">Amount</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {samplePayments.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs text-gray-500">
                {p.id}
              </TableCell>
              <TableCell className="font-medium text-gray-900">
                {p.merchant}
              </TableCell>
              <TableCell className="text-right font-semibold text-gray-900 tabular-nums">
                {formatCurrency(Number(p.amount))}
              </TableCell>
              <TableCell>
                <StatusBadge status={p.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  ),
};
