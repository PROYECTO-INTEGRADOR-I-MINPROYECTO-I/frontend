import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { useState } from "react";
import { CreatableSelect, type SelectOption } from "./creatable-select";

const OPTIONS: SelectOption[] = [
  { id: 1, name: "Boda", custom: false },
  { id: 9, name: "Retiro", custom: true },
];

function Wrapper({ onDelete }: { onDelete: (option: SelectOption) => Promise<unknown> }) {
  const [value, setValue] = useState<string | number>("");
  return (
    <CreatableSelect label="Tipo" options={OPTIONS} value={value} onChange={setValue} onCreate={vi.fn()} onDelete={onDelete} />
  );
}

describe("CreatableSelect: eliminar tipo personalizado", () => {
  test("solo los personalizados muestran Eliminar y piden confirmación", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<Wrapper onDelete={onDelete} />);

    await user.selectOptions(screen.getByLabelText("Tipo"), "1");
    expect(screen.queryByRole("button", { name: /Eliminar tipo/ })).toBeNull();

    await user.selectOptions(screen.getByLabelText("Tipo"), "9");
    await user.click(screen.getByRole("button", { name: "Eliminar tipo «Retiro»" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(onDelete).toHaveBeenCalledWith(OPTIONS[1]);
    expect(screen.queryByRole("option", { name: "Retiro" })).toBeNull();
    expect(screen.getByLabelText("Tipo")).toHaveValue("");
  });

  test("si falla el borrado muestra el error y conserva la opción", async () => {
    const user = userEvent.setup();
    render(<Wrapper onDelete={vi.fn().mockRejectedValue(new Error("x"))} />);

    await user.selectOptions(screen.getByLabelText("Tipo"), "9");
    await user.click(screen.getByRole("button", { name: "Eliminar tipo «Retiro»" }));
    await user.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo eliminar");
    expect(screen.getByRole("option", { name: "Retiro" })).toBeInTheDocument();
  });
});
