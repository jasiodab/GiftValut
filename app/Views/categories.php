<?php
$categories = $categories ?? [];
$currency = $settings['currency'] ?? 'PLN';
$totalProducts = array_sum(array_map(static fn ($c) => (int) $c['productCount'], $categories));
$totalValue = array_sum(array_map(static fn ($c) => (float) $c['totalValue'], $categories));
?>
<div class="page-header">
  <div class="page-header-main">
    <h1 class="page-title">Kategorie</h1>
    <p class="page-desc">Uporządkuj kolekcję w prosty, czytelny sposób.</p>
  </div>
  <div class="page-actions">
    <button class="btn" type="button" id="newCategoryBtn"><?= icon('plus') ?> Nowa kategoria</button>
  </div>
</div>

<?php if (!empty($categories)): ?>
  <div class="stats-inline">
    <span class="stat-inline"><strong><?= e(count($categories)) ?></strong> <?= e(plural_pl(count($categories), 'kategoria', 'kategorie', 'kategorii')) ?></span>
    <span class="stat-inline"><strong><?= e($totalProducts) ?></strong> <?= e(plural_pl($totalProducts, 'produkt', 'produkty', 'produktów')) ?></span>
    <span class="stat-inline"><strong><?= e(format_compact_money($totalValue, $currency)) ?></strong> łączna wartość</span>
  </div>
<?php endif; ?>

<?php if (empty($categories)): ?>
  <div class="empty-state">
    <div class="empty-icon"><?= icon('tags') ?></div>
    <h3>Nie masz jeszcze kategorii</h3>
    <p>Utwórz pierwszą kategorię, aby łatwiej porządkować pomysły na prezenty.</p>
    <div class="empty-action">
      <button class="btn btn-sm" type="button" id="newCategoryBtn2"><?= icon('plus') ?> Utwórz kategorię</button>
    </div>
  </div>
<?php else: ?>
  <div class="entity-list">
    <?php foreach ($categories as $c): ?>
      <div class="entity-row">
        <div class="entity-icon" style="background:<?= e($c['color']) ?>22;color:<?= e($c['color']) ?>"><?= icon(lucide_name($c['icon'])) ?></div>
        <div class="entity-body">
          <div class="entity-name">
            <a href="<?= e(url('/products?categoryId=' . urlencode($c['id']))) ?>"><?= e($c['name']) ?></a>
            <?php if ($c['isDefault']): ?><span class="badge badge-muted">Domyślna</span><?php endif; ?>
          </div>
          <div class="entity-meta"><?= e($c['productCount']) ?> <?= e(plural_pl((int) $c['productCount'], 'produkt', 'produkty', 'produktów')) ?></div>
        </div>
        <div class="entity-value"><?= e(format_money($c['totalValue'], $currency)) ?></div>
        <div class="entity-actions">
          <a class="icon-btn" href="<?= e(url('/products?categoryId=' . urlencode($c['id']))) ?>" title="Zobacz produkty" aria-label="Zobacz produkty w kategorii <?= e($c['name']) ?>"><?= icon('arrow-right') ?></a>
          <button class="icon-btn" type="button" data-edit-cat="<?= e($c['id']) ?>" data-name="<?= e($c['name']) ?>" data-color="<?= e($c['color']) ?>" data-icon="<?= e($c['icon']) ?>" title="Edytuj kategorię" aria-label="Edytuj kategorię <?= e($c['name']) ?>"><?= icon('edit-2') ?></button>
          <?php if (!$c['isDefault']): ?>
            <button class="icon-btn is-destructive" type="button" data-delete-cat="<?= e($c['id']) ?>" data-name="<?= e($c['name']) ?>" title="Usuń kategorię" aria-label="Usuń kategorię <?= e($c['name']) ?>"><?= icon('trash-2') ?></button>
          <?php endif; ?>
        </div>
      </div>
    <?php endforeach; ?>
  </div>
<?php endif; ?>

<div class="modal" id="categoryModal" role="dialog" aria-modal="true" aria-labelledby="catModalTitle">
  <div class="modal-dialog">
    <div class="modal-header">
      <div class="modal-header-row">
        <div>
          <h2 class="modal-title" id="catModalTitle">Nowa kategoria</h2>
          <p class="modal-desc" id="catModalDesc">Wybierz nazwę, delikatny kolor i ikonę.</p>
        </div>
        <button class="modal-close" type="button" id="catClose" aria-label="Zamknij"><?= icon('x') ?></button>
      </div>
    </div>
    <div class="modal-form-body">
      <div class="field">
        <label class="label" for="catName">Nazwa</label>
        <input class="input" id="catName" type="text" maxlength="40" placeholder="np. Książki, Biżuteria, Technologia">
      </div>
      <div class="field mt-3">
        <label class="label">Kolor</label>
        <div class="swatches" id="catSwatches"></div>
      </div>
      <div class="field mt-3">
        <label class="label">Ikona</label>
        <div class="icon-picker" id="catIcons"></div>
      </div>
      <input type="hidden" id="catId">
      <input type="hidden" id="catColor" value="#D9A3B0">
      <input type="hidden" id="catIcon" value="Tag">
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline btn-sm" type="button" id="catCancel">Anuluj</button>
      <button class="btn btn-sm" type="button" id="catSave">Utwórz kategorię</button>
    </div>
  </div>
</div>
