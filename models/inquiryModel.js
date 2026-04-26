const db = require("../config/db");
const dbPromise = db.promise();

const createInquiry = async (data) => {
    const query=`
    INSERT INTO inquiries (name,email,phone,subject,message,ip_address,user_agent)
    VALUES (?,?,?,?,?,?,?)
    `
    const values =[
        data.name,
        data.email,
        data.phone,
        data.subject,
        data.message,
        data.ip_address,
        data.user_agent,


    ];
    const [result] = await dbPromise.execute(query, values);
    return result;
};

const getAllInquiries = async () => {
  const [rows] = await dbPromise.execute(
    "SELECT * FROM inquiries ORDER BY created_at DESC"
  );
  return rows;
};

module.exports = {
  createInquiry,
  getAllInquiries,
};
