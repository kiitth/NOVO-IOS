
/* NOVO IOS Orders & Deliveries — Black Edition */
#ordersModule {
    padding: clamp(18px, 2.2vw, 30px);
    color: var(--ink, #edf3ff);
  }
  
  #ordersModule .orders-hero,
  #ordersModule .orders-subhead,
  #ordersModule .orders-table-heading,
  #ordersModule .orders-card-head,
  #ordersModule .orders-form-footer,
  #ordersModule .orders-card-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  
  #ordersModule .orders-hero {
    margin-bottom: 16px;
  }
  
  #ordersModule .orders-hero h2 {
    font-size: 25px;
    margin: 4px 0;
  }
  
  #ordersModule .orders-hero p,
  #ordersModule .orders-subhead p {
    margin: 0;
    font-size: 12px;
  }
  
  #ordersModule .orders-notice {
    padding: 12px 15px;
    margin-bottom: 18px;
    background: #112b36;
    border: 1px solid #28536a;
    border-radius: 11px;
    color: #aedeea;
    font-size: 12px;
  }
  
  #ordersModule .orders-danger {
    padding: 14px;
    margin: 12px 0;
    background: #462326;
    border: 1px solid #b45a61;
    border-radius: 10px;
    color: #ffd9d8;
    font-weight: 700;
  }
  
  #ordersModule .orders-overview {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 21px;
  }
  
  #ordersModule .orders-metric {
    position: relative;
    min-height: 105px;
    padding: 17px;
    background: linear-gradient(155deg, #1e2a3d, #121b2a);
    border: 1px solid #35465e;
    border-radius: 13px;
  }
  
  #ordersModule .orders-metric-label {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: #a7bad1;
  }
  
  #ordersModule .orders-metric strong {
    display: block;
    margin-top: 7px;
    color: #eff5ff;
    font-size: 29px;
    line-height: 1;
  }
  
  #ordersModule .orders-metric-icon {
    position: absolute;
    right: 17px;
    top: 15px;
    display: grid;
    place-items: center;
    width: 29px;
    height: 29px;
    background: #22416b;
    border-radius: 8px;
    color: #a6caff;
    font-weight: 800;
  }
  
  #ordersModule .orders-subpanel {
    margin: 0 0 22px;
    padding: 22px;
    background: #101824;
    border: 1px solid #2d3b50;
    border-radius: 15px;
  }
  
  #ordersModule .orders-subhead {
    margin-bottom: 18px;
  }
  
  #ordersModule h3 {
    margin: 3px 0 5px;
    color: #f0f5ff;
    font-size: 18px;
  }
  
  #ordersModule h4 {
    margin: 4px 0;
    color: #f0f5ff;
    font-size: 16px;
  }
  
  #ordersModule .orders-fields {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }
  
  #ordersModule label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: #bdcce1;
    font-size: 11px;
    font-weight: 730;
  }
  
  #ordersModule input,
  #ordersModule select,
  #ordersModule textarea {
    width: 100%;
    background: #0c1420;
    color: #edf4ff;
  }
  
  #ordersModule .orders-notes-label {
    margin: 13px 0;
  }
  
  #ordersModule .orders-notes-label textarea {
    resize: vertical;
  }
  
  #ordersModule .orders-table-heading {
    margin: 17px 0 9px;
  }
  
  #ordersModule .orders-table-heading strong {
    font-size: 13px;
  }
  
  #ordersModule table {
    min-width: 900px;
  }
  
  #ordersModule th {
    font-size: 10px;
  }
  
  #ordersModule td {
    font-size: 12px;
  }
  
  #ordersModule .orders-number {
    min-width: 72px;
    max-width: 110px;
    padding: 8px 9px;
    font-variant-numeric: tabular-nums;
  }
  
  #ordersModule .orders-form-footer {
    margin-top: 16px;
  }
  
  #ordersModule .orders-form-footer .muted {
    font-size: 12px;
  }
  
  #ordersModule .orders-filter {
    min-width: 170px;
  }
  
  #ordersModule .orders-filter select {
    min-height: 38px;
  }
  
  #ordersModule .orders-empty {
    padding: 30px;
    background: #121d2b;
    border: 1px dashed #3c4a60;
    border-radius: 12px;
    text-align: center;
  }
  
  #ordersModule .orders-empty strong {
    color: #d9e8ff;
  }
  
  #ordersModule .orders-empty p {
    color: #a1b2c8;
    font-size: 12px;
  }
  
  #ordersModule .orders-card {
    padding: 19px;
    margin: 13px 0;
    background: linear-gradient(160deg, #1a2535, #121b29);
    border: 1px solid #34445d;
    border-radius: 14px;
  }
  
  #ordersModule .orders-card-head {
    align-items: flex-start;
  }
  
  #ordersModule .orders-overline {
    color: #8dabd3;
    font-size: 10px;
    font-weight: 850;
    letter-spacing: .12em;
  }
  
  #ordersModule .orders-card-head p {
    margin: 4px 0;
    font-size: 11px;
  }
  
  #ordersModule .orders-state {
    padding: 7px 11px;
    border-radius: 20px;
    background: #2b364c;
    color: #cbd8ef;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
  }
  
  #ordersModule .orders-state-draft {
    background: #29364b;
    color: #c9dfff;
  }
  
  #ordersModule .orders-state-ordered {
    background: #193e66;
    color: #a5cbff;
  }
  
  #ordersModule .orders-state-partially-received {
    background: #4b361e;
    color: #ffd09a;
  }
  
  #ordersModule .orders-state-received {
    background: #164536;
    color: #a6f4d0;
  }
  
  #ordersModule .orders-state-closed-short {
    background: #403125;
    color: #f5cba7;
  }
  
  #ordersModule .orders-state-cancelled {
    background: #45303c;
    color: #e4a9b8;
  }
  
  #ordersModule .orders-price-total {
    color: #bfcde0;
    font-size: 11.5px;
    margin: 10px 0 15px;
  }
  
  #ordersModule .orders-edit-grid {
    display: grid;
    grid-template-columns: 1fr 1fr auto;
    gap: 12px;
    align-items: end;
    padding: 14px;
    margin: 10px 0 17px;
    border: 1px solid #2d3d52;
    border-radius: 11px;
    background: #111b2a;
  }
  
  #ordersModule .orders-detail-notes {
    grid-column: 1 / 3;
  }
  
  #ordersModule .orders-edit-grid .secondary-btn {
    justify-self: end;
  }
  
  #ordersModule .orders-receiving-table {
    min-width: 1040px;
  }
  
  #ordersModule .orders-outstanding {
    color: #f5c38b;
    font-weight: 750;
  }
  
  #ordersModule .orders-fulfilled {
    color: #96dbb8;
  }
  
  #ordersModule .orders-receipt-footer {
    display: flex;
    align-items: end;
    flex-wrap: wrap;
    gap: 12px;
    padding: 14px 0 4px;
  }
  
  #ordersModule .orders-receipt-footer label {
    flex: 1 1 190px;
  }
  
  #ordersModule .orders-receipt-footer button {
    flex: 0 0 auto;
  }
  
  #ordersModule .orders-caption {
    margin: 4px 0 12px;
    color: #8ca0ba;
    font-size: 11px;
  }
  
  #ordersModule .orders-card-actions {
    justify-content: flex-end;
    margin-top: 14px;
  }
  
  #ordersModule .orders-history {
    margin-top: 15px;
    overflow: hidden;
    border: 1px solid #31445d;
    border-radius: 9px;
  }
  
  #ordersModule .orders-history summary {
    padding: 12px;
    color: #b4d3ff;
    background: #17253a;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  
  #ordersModule .orders-history-body {
    padding: 0 12px 10px;
  }
  
  #ordersModule .orders-history-entry {
    padding: 10px 0;
    border-bottom: 1px solid #2b3b51;
  }
  
  #ordersModule .orders-history-entry:last-child {
    border-bottom: 0;
  }
  
  #ordersModule .orders-history-entry strong {
    display: block;
    color: #dfebfa;
    font-size: 12px;
  }
  
  #ordersModule .orders-history-entry small {
    display: block;
    color: #9fb1c9;
    font-size: 11px;
    white-space: normal;
  }
  
  #ordersModule .orders-prior-price {
    color: #a9bbd4;
  }
  
  #ordersModule .orders-success,
  #ordersModule .orders-error {
    padding: 10px 2px;
    font-weight: 700;
    font-size: 12px;
  }
  
  #ordersModule .orders-success {
    color: #90e6b8;
  }
  
  #ordersModule .orders-error {
    color: #ff9ba8;
  }
  
  /* ==========================================
     RESPONSIVE LAYOUT
     ========================================== */
  
  @media (max-width: 1050px) {
    #ordersModule .orders-fields {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  
    #ordersModule .orders-edit-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  
    #ordersModule .orders-edit-grid .secondary-btn {
      justify-self: start;
    }
  }
  
  @media (max-width: 650px) {
    #ordersModule .orders-overview {
      grid-template-columns: 1fr;
    }
  
    #ordersModule .orders-subpanel {
      padding: 14px;
    }
  
    #ordersModule .orders-fields,
    #ordersModule .orders-edit-grid {
      grid-template-columns: 1fr;
    }
  
    #ordersModule .orders-detail-notes {
      grid-column: auto;
    }
  
    #ordersModule .orders-receipt-footer button {
      width: 100%;
    }
  
    #ordersModule .orders-hero h2 {
      font-size: 22px;
    }
  }
  
