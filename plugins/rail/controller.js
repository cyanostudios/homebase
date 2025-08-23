// plugins/rail/controller.js
const service = require('./service');

module.exports = {
  async getAnnouncements(req, res) {
    try {
      const station = (req.query.station || 'Cst').trim();
      const announcements = await service.getAnnouncements(station);
      res.json({ station, announcements });
    } catch (err) {
      console.error('Rail getAnnouncements error:', err);
      res.status(500).json({ error: 'Failed to fetch announcements from Trafikverket' });
    }
  },

  async getStations(req, res) {
    try {
      
      const force = req.query.force === '1' || req.query.force === 'true';
      const stations = await service.getStations({ force });
      
      res.json({ count: stations.length, stations });
  
    } catch (err) {
      console.error('Rail getStations error:', err);
      res.status(500).json({ error: 'Failed to fetch stations from Trafikverket' });
    }
  },
};
