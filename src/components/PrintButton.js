"use client";

import Icon from "@/components/Icon";

export default function PrintButton() {
  return (
    <button className="button button-primary" onClick={() => window.print()} type="button">
      <Icon name="print" size={18} /> Print or save as PDF
    </button>
  );
}
