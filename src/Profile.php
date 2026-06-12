<?php

namespace GlpiPlugin\Carbooking;

use CommonDBTM;
use CommonGLPI;
use Html;
use Profile as GlpiProfile;

class Profile extends CommonDBTM
{
    public static $rightname = 'profile';

    public static function getTypeName($nb = 0)
    {
        return __('Agendamento de Carros', 'carbooking');
    }

    /**
     * Direitos do plugin.
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

    /**
     * Nome da aba em Administração > Perfis.
     */
    public function getTabNameForItem(CommonGLPI $item, $withtemplate = 0)
    {
        if ($item instanceof GlpiProfile && $item->getID()) {
            return self::getTypeName();
        }

        return '';
    }

    /**
     * Conteúdo da aba.
     */
    public static function displayTabContentForItem(
        CommonGLPI $item,
        $tabnum = 1,
        $withtemplate = 0
    ) {
        if ($item instanceof GlpiProfile && $item->getID()) {
            self::showForProfile((int)$item->getID());
        }

        return true;
    }

    /**
     * Exibe a matriz de permissões.
     */
    public static function showForProfile(int $profiles_id): void
    {
        $canedit = self::canUpdate();

        echo "<div class='spaced'>";

        echo "<form method='post' action='" . GlpiProfile::getFormURL() . "'>";

        GlpiProfile::displayRightsChoiceMatrix(
            self::getAllRights(),
            [
                'canedit'       => $canedit,
                'default_class' => 'tab_bg_2',
                'title'         => self::getTypeName(),
            ]
        );

        if ($canedit) {
            echo Html::hidden('id', ['value' => $profiles_id]);

            echo "<div class='center'>";
            echo "<button class='btn btn-primary' type='submit' name='update' value='1'>";
            echo "<i class='ti ti-device-floppy'></i> ";
            echo _sx('button', 'Save');
            echo "</button>";
            echo "</div>";
        }

        Html::closeForm();

        echo "</div>";
    }
}