import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownContent } from "./markdown-content";

describe("MarkdownContent", () => {
  it("renders a GFM table", () => {
    const md = "| A | B |\n| --- | --- |\n| 1 | 2 |\n";
    render(<MarkdownContent markdown={md} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("strips a javascript: link href but keeps the visible text", () => {
    const { container } = render(<MarkdownContent markdown="[click me](javascript:alert(1))" />);
    const link = container.querySelector("a");
    expect(link).toHaveTextContent("click me");
    expect(link).not.toHaveAttribute("href", "javascript:alert(1)");
  });

  it("keeps a safe https link intact and opens it in a new tab safely", () => {
    render(<MarkdownContent markdown="[go](https://example.com)" />);
    const link = screen.getByRole("link", { name: "go" });
    expect(link).toHaveAttribute("href", "https://example.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("renders a fenced code block with a copy button that copies its text", () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    const { container } = render(<MarkdownContent markdown={"```python\nprint(42)\n```"} />);
    expect(container.querySelector("code")).toHaveTextContent("print(42)");

    fireEvent.click(screen.getByRole("button", { name: /copiaz/i }));
    expect(writeText).toHaveBeenCalledWith("print(42)");
  });

  it("lets renderCodeBlock replace a specific language's block entirely", () => {
    render(
      <MarkdownContent
        markdown={"```python\nprint(1)\n```"}
        renderCodeBlock={({ language }) =>
          language === "python" ? <div data-testid="custom-python">custom</div> : undefined
        }
      />,
    );
    expect(screen.getByTestId("custom-python")).toBeInTheDocument();
  });

  it("falls back to default rendering when renderCodeBlock returns undefined", () => {
    const { container } = render(
      <MarkdownContent
        markdown={"```javascript\nconsole.log(1)\n```"}
        renderCodeBlock={({ language }) => (language === "python" ? <div /> : undefined)}
      />,
    );
    expect(container.querySelector("code")).toHaveTextContent("console.log(1)");
  });

  it("renders KaTeX math", () => {
    const { container } = render(<MarkdownContent markdown="$x^2$" />);
    expect(container.querySelector(".katex")).not.toBeNull();
  });
});
