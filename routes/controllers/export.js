const check = new (require("../../lib/Check"))();
const { checkConnection } = require("../utils");
const Yardim = require("../../models/yardimModel");
const YardimEt = require("../../models/yardimEtModel");
const YardimKaydi = require("../../models/yardimKaydiModel");
const Iletisim = require("../../models/iletisimModel");

module.exports = async function (fastifyInstance) {
  fastifyInstance.get(
    "/export",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            veriTipi: { type: "string" },
          },
          required: ["veriTipi"],
        },
      },
    },
    async function (req, res) {
      let veriTipi = req.query.veriTipi;
      if (!veriTipi) {
        return {
          error: "veriTipi queryParameter zorunludur.",
        };
      }

      await checkConnection(fastifyInstance);

      res.raw.setHeader("Content-Type", "text/csv charset=utf-8");
      res.raw.setHeader("Content-Encoding", "utf-8");
      res.raw.setHeader(
        "Content-Disposition",
        `attachment; filename=${veriTipi} export ${Date.now()}.csv`
      );

      try {
        return exportData(veriTipi);
      } catch (e) {
        res.statusCode = 500;
        return {
          error: "export sirasinda hata olustu.",
        };
      }

    },
  );

  fastifyInstance.get(
    "/exportStream",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            veriTipi: { type: "string" },
          },
          required: ["veriTipi"],
        },
      },
    },
    async function (req, res) {
      let veriTipi = req.query.veriTipi;
      if (!veriTipi) {
        return {
          error: "veriTipi queryParameter zorunludur.",
        };
      }

      await checkConnection(fastifyInstance);

      res.raw.setHeader("Content-Type", "text/csv charset=utf-8");
      res.raw.setHeader("Content-Encoding", "utf-8,%EF%BB%BF");
      res.raw.setHeader(
        "Content-Disposition",
        `attachment; filename=${veriTipi} export ${Date.now()}.csv`
      );

      try {
        return exportData(veriTipi, res.raw);
      } catch (e) {
        res.statusCode = 500;
        return {
          error: "export sirasinda hata olustu.",
        };
      }

    },
  );

  fastifyInstance.post(
    "/mailExport",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            veriTipi: { type: "string" },
            mailler: { type: "array" },
          },
          required: ["veriTipi", "mailler"],
        },
      },
    },
    async function (req, res) {
      req.body = check.xssFilter(req.body);
      await checkConnection(fastifyInstance);

      let veriTipi = req.body.veriTipi;
      let mailler = req.body.mailler;

      if (!mailler || mailler.length === 0) {
        res.statusCode = 400;
        return {
          error: "Lutfen mail belirtiniz.",
        };
      }

      try {
        let data = await exportData(veriTipi);
        if (!data || data.length === 0) {
          res.statusCode = 400;
          return {
            error: "export verisi bulunmamaktadir.",
          };
        }

        res.raw.setHeader("Content-Type", "text/csv charset=utf-8");
        res.raw.setHeader("Content-Encoding", "utf-8,%EF%BB%BF");
        res.raw.setHeader(
          "Content-Disposition",
          `attachment; filename=${veriTipi} export ${Date.now()}.csv`
        );

        // Email gonder
        console.log(data)
      } catch (e) {
        res.statusCode = 500;
        return {
          error: "exportu mail atarken hata olustu.",
        };
      }

    },
  );
};

async function exportData(veriTipi, io) {
  let select;
  let queryDoc;

  if (veriTipi === "YardimEt") {
    select = "yardimTipi adSoyad telefon sehir hedefSehir aciklama fields createdAt updatedAt";
    queryDoc = YardimEt;
  } else if (veriTipi === "Yardim") {
    select = "yardimTipi adSoyad telefon email adres adresTarifi acilDurum kisiSayisi yardimDurumu fizikiDurum " +
      "googleMapLink tweetLink fields createdAt updatedAt";
    queryDoc = Yardim;
  } else if (veriTipi === "YardimKaydi") {
    select = "yardimTipi adSoyad telefon sonDurum adres email aciklama createdAt updatedAt";
    queryDoc = YardimKaydi;
  } else if (veriTipi === "Iletisim") {
    select = "adSoyad email telefon mesaj createdAt updatedAt";
    queryDoc = Iletisim;
  } else {
    return "";
  }

  let data = await queryDoc.find({})
    .select(select)
    .then(data => {
      return data;
    })

  processData(data, io);

  if (io) {
    io.end();
  }
  return data;
}

const header = (obj) => {
  if (!obj) return "";
  let keys = [];

  for (let key of Object.keys(obj)) {
    if (typeof (obj[key]) === "object") {
      let headerName = header(obj[key]);
      if (headerName && headerName.trim() !== "") {
        keys.push(headerName);
      }
    } else {
      if (key && key.trim() !== "") {
        keys.push(key);
      }
    }
  }

  return keys.length > 0 ? keys.join(", ") : "";
};

const row = (obj) => {
  if (!obj) return "";
  let values = [];

  for (let key of Object.keys(obj)) {
    if (typeof (obj[key]) === "object") {
      let value = row(obj[key]);
      if (value) {
        values.push(value);
      }
    } else {
      let value = obj[key].replaceAll(",", " "); // separator keyword
      if (value) {
        values.push(value);
      }
    }
  }

  return values.length > 0 ? values.join(", ") : "";
};

const processData = (data, io) => {
  if (!data || data.length === 0) {
    return "";
  }

  let csvExportString = "";
  let headerString = header(data[0]._doc) + "\n";
  csvExportString += headerString;

  if (io) {
    io.write(headerString);
  }

  data.forEach(dataItem => {
    let rowString = row(dataItem._doc) + "\n";
    if (io) {
      io.write(rowString);
    }
    csvExportString += rowString;
  });

  return csvExportString;
}