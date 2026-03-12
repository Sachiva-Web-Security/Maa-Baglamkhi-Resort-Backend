const db = require("../config/db");

const createReference = (data, callback)=>{

const sql = `
INSERT INTO reference_notes
(guest_id, guest_type, guest_notes, internal_notes)
VALUES (?,?,?,?)
`;

db.query(sql,[
data.booking_id,
data.guestType,
data.guestNotes,
data.internalNotes
],callback)

}

module.exports = {
createReference
}