import logging from '@tryghost/logging';
import {
  combineNonTransactionalMigrations,
  createAddColumnMigration,
  createNonTransactionalMigration,
} from '../../utils';

// Apps are behind a private labs flag, so these tables only hold test data. Stored manifests
// have no `access` field, which every manifest now needs and which says what an installation
// was approved for, so none of them can be read back or run. The staff history of those
// installations goes with them, as nothing can show it any more.
//
// Each manifest row now stores what changed from the approved manifest when it was added,
// which can't be added to filled rows without recomputing it, so the column is added once
// the table is empty.
export default combineNonTransactionalMigrations(
  createNonTransactionalMigration(
    async function up(knex) {
      const actions = await knex('actions').where({ resource_type: 'app_installation' }).del();
      // Manifests first, as each references its installation.
      const manifests = await knex('app_installation_manifests').del();
      const installations = await knex('app_installations').del();
      logging.info(
        `Cleared ${installations} app installations, ${manifests} app installation manifests and ${actions} of their staff history entries`,
      );
    },
    async function down() {
      logging.warn('Not restoring cleared app installations, which were test data');
    },
  ),
  createAddColumnMigration('app_installation_manifests', 'changes', {
    type: 'text',
    maxlength: 65535,
    nullable: false,
  }),
);
