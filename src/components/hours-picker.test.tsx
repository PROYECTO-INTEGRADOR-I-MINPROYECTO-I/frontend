import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { useState } from "react";
import { HoursPicker } from "./hours-picker";

// Wrapper controlado: HoursPicker es un componente controlado (value/onChange
// en horas), así que los tests necesitan un padre con estado real para poder
// verificar los cambios entre un clic y el siguiente.
function ControlledHoursPicker({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <HoursPicker id="subtask-hours" value={value} onChange={setValue} />;
}

describe("HoursPicker", () => {
  test("los chips de 5, 10 y 15 min producen 0.08, 0.17 y 0.25 horas", async () => {
    const user = userEvent.setup();
    const values: string[] = [];
    function Wrapper() {
      const [value, setValue] = useState("");
      return (
        <HoursPicker
          id="subtask-hours"
          value={value}
          onChange={(next) => {
            setValue(next);
            values.push(next);
          }}
        />
      );
    }
    render(<Wrapper />);

    await user.click(screen.getByRole("button", { name: "5 min" }));
    await user.click(screen.getByRole("button", { name: "10 min" }));
    await user.click(screen.getByRole("button", { name: "15 min" }));

    expect(values).toEqual(["0.08", "0.17", "0.25"]);
  });

  test("el stepper sube y baja de 5 en 5 minutos", async () => {
    const user = userEvent.setup();
    render(<ControlledHoursPicker initialValue="0.17" />); // 10 min
    const status = screen.getByRole("status");

    expect(status).toHaveTextContent("10 min");

    await user.click(screen.getByRole("button", { name: "Sumar 5 minutos" }));
    expect(status).toHaveTextContent("15 min");

    await user.click(screen.getByRole("button", { name: "Sumar 5 minutos" }));
    expect(status).toHaveTextContent("20 min");

    await user.click(screen.getByRole("button", { name: "Restar 5 minutos" }));
    expect(status).toHaveTextContent("15 min");
  });

  test("el mínimo es 5 min: 'Restar 5 minutos' se deshabilita ahí", () => {
    render(<ControlledHoursPicker initialValue="0.08" />); // 5 min

    expect(screen.getByRole("button", { name: "Restar 5 minutos" })).toBeDisabled();
  });

  test("el máximo es 24 h: 'Sumar 5 minutos' se deshabilita ahí", () => {
    render(<ControlledHoursPicker initialValue="24.00" />); // 1440 min

    expect(screen.getByRole("button", { name: "Sumar 5 minutos" })).toBeDisabled();
  });

  test("sin valor, 'Sumar 5 minutos' arranca en 5 min", async () => {
    const user = userEvent.setup();
    render(<ControlledHoursPicker />);

    await user.click(screen.getByRole("button", { name: "Sumar 5 minutos" }));

    expect(screen.getByRole("status")).toHaveTextContent("5 min");
  });

  test("muestra la etiqueta legible de la duración actual", () => {
    const { unmount } = render(<ControlledHoursPicker initialValue="0.08" />);
    expect(screen.getByRole("status")).toHaveTextContent("5 min");
    unmount();

    render(<ControlledHoursPicker initialValue="2.50" />);
    expect(screen.getByRole("status")).toHaveTextContent("2 h 30 min");
  });

  test("el grupo es obligatorio (aria-required)", () => {
    render(<ControlledHoursPicker />);

    expect(screen.getByRole("group")).toHaveAttribute("aria-required", "true");
  });
});
