const {
  createInquiryService,
  getAllInquiriesService,
} = require("../Services/inquiryService");

const createInquiryController = async (req, res) => {
    try{
        const result =await createInquiryService(req.body,req);
        res.status(201).json({
            success:true,
            message:"Inquiry created successfully",
            data:result,
            
        });
    }catch(error){
            res.status(400).json({
                success:false,
                message:error.message ,
            });
        }
    };

const getAllInquiriesController = async (req, res) => {
  try {
    const data = await getAllInquiriesService();

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createInquiryController,
  getAllInquiriesController,
};
