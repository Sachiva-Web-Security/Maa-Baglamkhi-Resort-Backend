const { createInquiry, getAllInquiries } = require("../models/inquiryModel");

const getAllInquiriesService = async () => {
  return await getAllInquiries();
};

const createInquiryService = async (data, req) => {
    const {name,email,phone,subject,message}=data;

// }validation
if(!name  || name.length<2){
    throw new Error ("Name must be at least 2 characters");

}
if(!email||!email.includes("@")){
    throw new Error ("valid email required");


}

if (!message || message.length<10){
    throw new Error ("message must be at least 10 characters ");
}
const result = await createInquiry({
    name:name.trim(),
    email:email.trim(),
    phone:phone||null,
    subject:subject||null,
    message:message||null,
    ip_address:req.ip || null,
    user_agent:req.headers["user-agent"] || null,

});
return {id:result.insertId};
};

module.exports = {
  createInquiryService,
  getAllInquiriesService,
};
