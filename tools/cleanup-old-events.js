const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function cleanupOldEvents(daysToKeep = 7) {
  try {
    console.log(`🧹 Pulizia eventi più vecchi di ${daysToKeep} giorni...`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const { data: events, error } = await supabase
      .from('events')
      .select('id, name, event_date, event_time');
    
    if (error) throw error;
    
    const eventsToDelete = events.filter(event => {
      const eventDateTime = new Date(`${event.event_date} ${event.event_time}`);
      return eventDateTime < cutoffDate;
    });
    
    if (eventsToDelete.length === 0) {
      console.log('✅ Nessun evento da cancellare');
      return;
    }
    
    console.log(`🗑️ Trovati ${eventsToDelete.length} eventi da cancellare:`);
    eventsToDelete.forEach(event => {
      console.log(`  - ${event.name} (${event.event_date} ${event.event_time})`);
    });
    
    const { error: deleteError } = await supabase
      .from('events')
      .delete()
      .in('id', eventsToDelete.map(e => e.id));
    
    if (deleteError) throw deleteError;
    
    console.log(`✅ Cancellati ${eventsToDelete.length} eventi con successo`);
    
  } catch (error) {
    console.error('❌ Errore durante la pulizia:', error.message);
    process.exit(1);
  }
}

const days = process.argv[2] ? parseInt(process.argv[2]) : 7;
cleanupOldEvents(days);
