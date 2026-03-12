const db = require("../config/db");

const addCompany = (data, callback) => {

const sql = `
INSERT INTO companies
(guest_id, company_name, gstin)
VALUES (?,?,?)
`;

db.query(sql,[
data.booking_id,
data.companyName,
data.gst
],callback)

}

module.exports = {
addCompany
}