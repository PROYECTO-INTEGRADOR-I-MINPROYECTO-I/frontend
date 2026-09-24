import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { useState } from "react";
import { HoursPicker } from "./hours-picker";
import { DURATION_STOPS } from "../lib/subtask-display";

// Wrapper controlado: HoursPicker es un componente controlado (value/onChange
// en horas), así que los tests necesitan un padre con estado real para poder
// verificar los cambios entre una interacción y la siguiente.
function ControlledHoursPicker({ initialValue = "" }: { initialValue?: string }) {
  const [value, setValue] = useState(initialValue);
  return <HoursPicker id="subtask-hours" value={value} onChange={setValue} />;
}

function renderWithSpy() {
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
  return values;
}

describe("DURATION_STOPS", () => {
  test("arranca en 5 min y termina en 24 h (1440 min)", () => {
    expect(DURATION_STOPS[0]).toBe(5);
    expect(DURATION_STOPS[DURATION_STOPS.length - 1]).toBe(1440);
  });

  test("tiene los tramos esperados: 5..60/5, 75..240/15, 270..720/30, 780..1440/60", () => {
    expect(DURATION_STOPS).toHaveLength(52);
    // Último del primer tramo y primero del segundo (el salto de 60 a 75 no es de 5 min).
    expect(DURATION_STOPS).toContain(60);
    expect(DURATION_STOPS).toContain(75);
    expect(DURATION_STOPS).not.toContain(65);
    // Los demás bordes de tramo.
    expect(DURATION_STOPS).toContain(240);
    expect(DURATION_STOPS).toContain(270);
    expect(DURATION_STOPS).toContain(720);
    expect(DURATION_STOPS).toContain(780);
  });
});

describe("HoursPicker: slider", () => {
  test("mover el slider al índice de 480 min produce '8.00' (minutesToHours(480))", () => {
    const values = renderWithSpy();

    const slider = screen.getByLabelText("Duración estimada");
    fireEvent.change(slider, { target: { value: String(DURATION_STOPS.indexOf(480)) } });

    expect(values.at(-1)).toBe("8.00");
  });

  test("mover el slider al índice de 360 min muestra '6 h'", () => {
    render(<ControlledHoursPicker />);

    const slider = screen.getByLabelText("Duración estimada");
    fireEvent.change(slider, { target: { value: String(DURATION_STOPS.indexOf(360)) } });

    expect(screen.getByRole("status")).toHaveTextContent("6 h");
  });

  test("un valor que no es un stop (2 h 35 min) posa el thumb en el stop más cercano, pero el texto muestra el valor exacto", () => {
    // 2 h 35 min = 155 min; no es un stop (75..240 va de 15 en 15: 150, 165…).
    // El más cercano es 150 (2 h 30 min), a 5 min de distancia contra 10 de 165.
    render(<ControlledHoursPicker initialValue="2.58" />);

    const slider = screen.getByLabelText("Duración estimada") as HTMLInputElement;
    expect(Number(slider.value)).toBe(DURATION_STOPS.indexOf(150));

    expect(screen.getByRole("status")).toHaveTextContent("2 h 35 min");
    // El lector de pantalla oye el valor real, no el stop.
    expect(slider).toHaveAttribute("aria-valuetext", "2 h 35 min");
  });

  test("sin valor, el thumb arranca en 1 h pero el estado dice 'Sin definir'", () => {
    render(<ControlledHoursPicker />);

    const slider = screen.getByLabelText("Duración estimada") as HTMLInputElement;
    expect(Number(slider.value)).toBe(DURATION_STOPS.indexOf(60));
    expect(screen.getByRole("status")).toHaveTextContent("Sin definir");
    expect(slider).toHaveAttribute("aria-valuetext", "Sin definir");
  });
});

describe("HoursPicker: campos H/MM editables", () => {
  test("escribir 6 h y 30 min, al perder el foco de Minutos produce '6.50'", () => {
    const values = renderWithSpy();

    fireEvent.change(screen.getByLabelText("Horas"), { target: { value: "6" } });
    fireEvent.change(screen.getByLabelText("Minutos"), { target: { value: "30" } });
    fireEvent.blur(screen.getByLabelText("Minutos"));

    expect(values.at(-1)).toBe("6.50");
  });

  test("minutos 7 se redondea a 5 al perder el foco", () => {
    const values = renderWithSpy();

    fireEvent.change(screen.getByLabelText("Minutos"), { target: { value: "7" } });
    fireEvent.blur(screen.getByLabelText("Minutos"));

    expect(values.at(-1)).toBe("0.08"); // 5 min
  });

  test("58 min redondea a 1 h (no se trunca a 55)", () => {
    const values = renderWithSpy();

    fireEvent.change(screen.getByLabelText("Horas"), { target: { value: "2" } });
    fireEvent.change(screen.getByLabelText("Minutos"), { target: { value: "58" } });
    fireEvent.blur(screen.getByLabelText("Minutos"));

    expect(values.at(-1)).toBe("3.00");
  });

  test("horas 30 se recorta a 24 h", () => {
    const values = renderWithSpy();

    fireEvent.change(screen.getByLabelText("Horas"), { target: { value: "30" } });
    fireEvent.blur(screen.getByLabelText("Horas"));

    expect(values.at(-1)).toBe("24.00");
  });

  test("0 h 0 min sube a 5 min", () => {
    const values = renderWithSpy();

    fireEvent.change(screen.getByLabelText("Horas"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Minutos"), { target: { value: "0" } });
    fireEvent.blur(screen.getByLabelText("Minutos"));

    expect(values.at(-1)).toBe("0.08"); // 5 min
  });

  test("Enter confirma el valor una sola vez y no envía el formulario que lo contiene", async () => {
    const values: string[] = [];
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    function FormWrapper() {
      const [value, setValue] = useState("");
      return (
        <form onSubmit={onSubmit}>
          <HoursPicker
            id="subtask-hours"
            value={value}
            onChange={(next) => {
              setValue(next);
              values.push(next);
            }}
          />
        </form>
      );
    }
    render(<FormWrapper />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Horas"), "2{Enter}");

    expect(values).toEqual(["2.00"]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  test("los campos rechazan caracteres que no son dígitos", () => {
    renderWithSpy();

    const hoursField = screen.getByLabelText("Horas") as HTMLInputElement;
    fireEvent.change(hoursField, { target: { value: "a1b2!" } });

    expect(hoursField.value).toBe("12");
  });
});

describe("HoursPicker: chips", () => {
  test("los chips son 15 min, 30 min, 1 h, 2 h, 4 h y 8 h", () => {
    renderWithSpy();

    for (const label of ["15 min", "30 min", "1 h", "2 h", "4 h", "8 h"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });

  test("elegir un chip actualiza el valor", async () => {
    const user = userEvent.setup();
    const values = renderWithSpy();

    await user.click(screen.getByRole("button", { name: "8 h" }));

    expect(values.at(-1)).toBe("8.00");
  });

  test("los chips y el stepper tienen objetivos táctiles de 44px", () => {
    render(<ControlledHoursPicker />);

    expect(screen.getByRole("button", { name: "8 h" })).toHaveClass("min-h-[44px]");
    expect(screen.getByRole("button", { name: "Restar 5 minutos" })).toHaveClass("h-11", "w-11");
    expect(screen.getByRole("button", { name: "Sumar 5 minutos" })).toHaveClass("h-11", "w-11");
  });
});

describe("HoursPicker: stepper ±5 min", () => {
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
});

describe("HoursPicker: otros", () => {
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
