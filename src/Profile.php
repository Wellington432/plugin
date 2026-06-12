<?php

namespace GlpiPlugin\Carbooking;

use CommonDBTM;
use CommonGLPI;
use Html;
use Profile as GlpiProfile;

/**
 * Gestão de permissões do plugin, exibida como aba dentro de
 * Administração > Perfis. Define os direitos sobre Carros e Agendamentos
 * (incluindo o direito específico de aprovação).
 */
class Profile extends CommonDBTM
{
    public static $rightname = 'profile';

    public static function getTypeName($nb = 0)
    {
        return __('Agendamento de Carros', 'carbooking');
    }

    /**
     * Lista de direitos do plugin, exibida na matriz de permissões.
     *
     * @return array<int, array<string, string>>
     */
    public static function getAllRights(): array
    {
        return [
            [
                'itemtype' => Car::class,
                'label'    => Car::getTypeName(2),
                'field'    => 'carbooking::car',
            ],
            [
                'itemtype' => Booking::class,
                'label'    => Booking::getTypeName(2),
                'field'    => 'carbooking::booking',
            ],
        ];
    }

    public function getTabNameForItem(CommonGLPI $item, $withtemplate = 0)
    {
        if ($item instanceof GlpiProfile && $item->getField('id')) {
            return self::createTabEntry(self::getTypeName());
        }
        return '';
    }

    public static function displayTabContentForItem(CommonGLPI $item, $tabnum = 1, $withtemplate = 0)
    {
        if ($item instanceof GlpiProfile && $item->getField('id')) {
            self::showForProfile((int) $item->getID());
        }
        return true;
    }

    /**
     * Renderiza a matriz de direitos para um perfil.
     */
    public static function showForProfile(int $profiles_id = 0): void
    {
        $canedit = self::canUpdate();

        $profile = new GlpiProfile();
        $profile->getFromDB($profiles_id);

        echo "<div class='spaced'>";
        echo "<form method='post' action='" . GlpiProfile::getFormURL() . "'>";

        $profile->displayRightsChoiceMatrix(self::getAllRights(), [
            'canedit'       => $canedit,
            'default_class' => 'tab_bg_2',
            'title'         => self::getTypeName(),
        ]);

        if ($canedit) {
            echo "<div class='center mt-2'>";
            echo Html::hidden('id', ['value' => $profiles_id]);
            echo "<button type='submit' name='update' value='1' class='btn btn-primary'>";
            echo "<i class='ti ti-device-floppy'></i> " . _sx('button', 'Save');
            echo "</button>";
            echo "</div>";
        }

        Html::closeForm();
        echo "</div>";
    }
}
