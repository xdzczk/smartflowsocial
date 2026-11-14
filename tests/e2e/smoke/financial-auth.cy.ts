describe("Smoke: financial and upload authorization", () => {
  it("rejects a manual referral payout without the payout secret", () => {
    cy.request({
      method: "POST",
      url: "/api/referral/manual-payout",
      failOnStatusCode: false,
      body: {
        referrer_npub: "npub1example",
        bolt11: "lnbc1",
        amount_sats: 1,
      },
    }).then((response) => {
      expect(response.status).to.be.oneOf([401, 404]);
      expect(response.body).to.not.have.property("success", true);
    });
  });

  it("rejects cron routes without the cron secret", () => {
    cy.request({
      method: "POST",
      url: "/cron/referral-payout",
      failOnStatusCode: false,
    }).then((response) => {
      expect(response.status).to.eq(401);
    });
  });

  it("does not accept an upload without a session", () => {
    cy.clearCookie("__session");
    cy.request({
      method: "POST",
      url: "/api/upload",
      failOnStatusCode: false,
      followRedirect: false,
      body: { unused: true },
    }).then((response) => {
      expect(response.status).to.be.oneOf([302, 303, 401, 403]);
    });
  });
});
